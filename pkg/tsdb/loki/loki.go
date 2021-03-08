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
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/interval"
	"github.com/grafana/loki/pkg/logcli/client"
	"github.com/grafana/loki/pkg/loghttp"
	"github.com/grafana/loki/pkg/logproto"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/common/model"
)

type LokiExecutor struct {
	intervalCalculator interval.Calculator
}

func NewExecutor(dsInfo *models.DataSource) (plugins.DataPlugin, error) {
	return newExecutor(), nil
}

func newExecutor() *LokiExecutor {
	return &LokiExecutor{
		intervalCalculator: interval.NewCalculator(interval.CalculatorOptions{MinInterval: time.Second * 1}),
	}
}

var (
	plog         = log.New("tsdb.loki")
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
)

// DataQuery executes a Loki query.
func (e *LokiExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource,
	queryContext plugins.DataQuery) (plugins.DataResponse, error) {
	result := plugins.DataResponse{
		Results: map[string]plugins.DataQueryResult{},
	}

	client := &client.DefaultClient{
		Address:  dsInfo.Url,
		Username: dsInfo.BasicAuthUser,
		Password: dsInfo.DecryptedBasicAuthPassword(),
	}

	queries, err := e.parseQuery(dsInfo, queryContext)
	if err != nil {
		return plugins.DataResponse{}, err
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
			return plugins.DataResponse{}, err
		}

		queryResult, err := parseResponse(value, query)
		if err != nil {
			return plugins.DataResponse{}, err
		}
		result.Results[query.RefID] = queryResult
	}

	return result, nil
}

//If legend (using of name or pattern instead of time series name) is used, use that name/pattern for formatting
func formatLegend(metric model.Metric, query *lokiQuery) string {
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

func (e *LokiExecutor) parseQuery(dsInfo *models.DataSource, queryContext plugins.DataQuery) ([]*lokiQuery, error) {
	qs := []*lokiQuery{}
	for _, queryModel := range queryContext.Queries {
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

		dsInterval, err := interval.GetIntervalFrom(dsInfo, queryModel.Model, time.Second)
		if err != nil {
			return nil, fmt.Errorf("failed to parse Interval: %v", err)
		}

		interval := e.intervalCalculator.Calculate(*queryContext.TimeRange, dsInterval)
		step := time.Duration(int64(interval.Value))

		qs = append(qs, &lokiQuery{
			Expr:         expr,
			Step:         step,
			LegendFormat: format,
			Start:        start,
			End:          end,
			RefID:        queryModel.RefID,
		})
	}

	return qs, nil
}

func parseResponse(value *loghttp.QueryResponse, query *lokiQuery) (plugins.DataQueryResult, error) {
	var queryRes plugins.DataQueryResult

	//We are currently processing only matrix results (for alerting)
	data, ok := value.Data.Result.(loghttp.Matrix)
	if !ok {
		return queryRes, fmt.Errorf("unsupported result format: %q", value.Data.ResultType)
	}

	for _, v := range data {
		series := plugins.DataTimeSeries{
			Name:   formatLegend(v.Metric, query),
			Tags:   make(map[string]string, len(v.Metric)),
			Points: make([]plugins.DataTimePoint, 0, len(v.Values)),
		}

		for k, v := range v.Metric {
			series.Tags[string(k)] = string(v)
		}

		for _, k := range v.Values {
			series.Points = append(series.Points, plugins.DataTimePoint{
				null.FloatFrom(float64(k.Value)), null.FloatFrom(float64(k.Timestamp.Unix() * 1000)),
			})
		}

		queryRes.Series = append(queryRes.Series, series)
	}

	return queryRes, nil
}
