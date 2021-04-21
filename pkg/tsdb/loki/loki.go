package loki

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/components/null"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/loki/pkg/logcli/client"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
)

type LokiExecutor struct{}

func NewLokiExecutor(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	return &LokiExecutor{}, nil
}

var (
	plog               log.Logger
	legendFormat       *regexp.Regexp
	intervalCalculator tsdb.IntervalCalculator
)

func init() {
	plog = log.New("tsdb.loki")
	tsdb.RegisterTsdbQueryEndpoint("loki", NewLokiExecutor)
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
	intervalCalculator = tsdb.NewIntervalCalculator(&tsdb.IntervalOptions{MinInterval: time.Second * 1})
}

func (e *LokiExecutor) Query(ctx context.Context, dsInfo *models.DataSource, tsdbQuery *tsdb.TsdbQuery) (*tsdb.Response, error) {
	result := &tsdb.Response{
		Results: map[string]*tsdb.QueryResult{},
	}

	tlsConfig, err := dsInfo.GetTLSConfig()
	if err != nil {
		return nil, err
	}

	client := &client.DefaultClient{
		Address:  dsInfo.Url,
		Username: dsInfo.BasicAuthUser,
		Password: dsInfo.DecryptedBasicAuthPassword(),
		TLSConfig: config.TLSConfig{
			InsecureSkipVerify: tlsConfig.InsecureSkipVerify,
		},
	}

	queries, err := parseQuery(dsInfo, tsdbQuery.Queries, tsdbQuery)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		plog.Debug("Sending query", "start", query.Start, "end", query.End, "step", query.Step, "query", query.Expr)
		span, _ := opentracing.StartSpanFromContext(ctx, "alerting.loki")
		span.SetTag("expr", query.Expr)
		span.SetTag("start_unixnano", query.Start.UnixNano())
		span.SetTag("stop_unixnano", query.End.UnixNano())
		defer span.Finish()

		//Currently hard coded as not used - applies to log queries
		limit := 1000
		//Currently hard coded as not used - applies to queries which produce a stream response
		interval := time.Second * 1

		value, err := client.QueryRange(query.Expr, limit, query.Start, query.End, logproto.BACKWARD, query.Step, interval, false)

		if err != nil {
			return nil, err
		}

		queryResult, err := parseResponse(value, query)
		if err != nil {
			return nil, err
		}
		result.Results[query.RefId] = queryResult
	}

	return result, nil
}

//If legend (using of name or pattern instead of time series name) is used, use that name/pattern for formatting
func formatLegend(metric model.Metric, query *LokiQuery) string {
	if query.LegendFormat == "" {
		return metric.String()
	}

	result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := metric[model.LabelName(labelName)]; exists {
			return []byte(val)
		}
		return []byte{}
	})

	return string(result)
}

func parseQuery(dsInfo *models.DataSource, queries []*tsdb.Query, queryContext *tsdb.TsdbQuery) ([]*LokiQuery, error) {
	qs := []*LokiQuery{}
	for _, queryModel := range queries {
		expr, err := queryModel.Model.Get("expr").String()
		if err != nil {
			return nil, fmt.Errorf("failed to parse Expr: %v", err)
		}

		format := queryModel.Model.Get("legendFormat").MustString("")

		start, err := queryContext.TimeRange.ParseFrom()
		if err != nil {
			return nil, fmt.Errorf("failed to parse From: %v", err)
		}

		end, err := queryContext.TimeRange.ParseTo()
		if err != nil {
			return nil, fmt.Errorf("failed to parse To: %v", err)
		}

		dsInterval, err := tsdb.GetIntervalFrom(dsInfo, queryModel.Model, time.Second)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Interval: %v", err)
		}

		interval := intervalCalculator.Calculate(queryContext.TimeRange, dsInterval)
		step := time.Duration(int64(interval.Value))

		qs = append(qs, &LokiQuery{
			Expr:         expr,
			Step:         step,
			LegendFormat: format,
			Start:        start,
			End:          end,
			RefId:        queryModel.RefId,
		})
	}

	return qs, nil
}

func parseResponse(value *loghttp.QueryResponse, query *LokiQuery) (*tsdb.QueryResult, error) {
	queryRes := tsdb.NewQueryResult()

	//We are currently processing only matrix results (for alerting)
	data, ok := value.Data.Result.(loghttp.Matrix)
	if !ok {
		return queryRes, fmt.Errorf("unsupported result format: %q", value.Data.ResultType)
	}

	for _, v := range data {
		series := tsdb.TimeSeries{
			Name:   formatLegend(v.Metric, query),
			Tags:   make(map[string]string, len(v.Metric)),
			Points: make([]tsdb.TimePoint, 0, len(v.Values)),
		}

		for k, v := range v.Metric {
			series.Tags[string(k)] = string(v)
		}

		for _, k := range v.Values {
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(float64(k.Value)), float64(k.Timestamp.Unix()*1000)))
		}

		queryRes.Series = append(queryRes.Series, &series)
	}

	return queryRes, nil
}
