package prometheus

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gopkg.in/guregu/null.v3"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/prometheus/client_golang/api/prometheus"
	pmodel "github.com/prometheus/common/model"
)

type PrometheusExecutor struct {
	*tsdb.DataSourceInfo
}

func NewPrometheusExecutor(dsInfo *tsdb.DataSourceInfo) tsdb.Executor {
	return &PrometheusExecutor{dsInfo}
}

var (
	plog         log.Logger
	legendFormat *regexp.Regexp
)

func init() {
	plog = log.New("tsdb.prometheus")
	tsdb.RegisterExecutor("prometheus", NewPrometheusExecutor)
	legendFormat = regexp.MustCompile(`\{\{\s*(.+?)\s*\}\}`)
}

func (e *PrometheusExecutor) getClient() (prometheus.QueryAPI, error) {
	cfg := prometheus.Config{
		Address: e.DataSourceInfo.Url,
	}

	client, err := prometheus.New(cfg)
	if err != nil {
		return nil, err
	}

	return prometheus.NewQueryAPI(client), nil
}

func (e *PrometheusExecutor) Execute(ctx context.Context, queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	client, err := e.getClient()
	if err != nil {
		return result.WithError(err)
	}

	query, err := parseQuery(queries, queryContext)
	if err != nil {
		return result.WithError(err)
	}

	timeRange := prometheus.Range{
		Start: query.Start,
		End:   query.End,
		Step:  query.Step,
	}

	value, err := client.QueryRange(ctx, query.Expr, timeRange)

	if err != nil {
		return result.WithError(err)
	}

	queryResult, err := parseResponse(value, query)
	if err != nil {
		return result.WithError(err)
	}
	result.QueryResults = queryResult
	return result
}

func formatLegend(metric pmodel.Metric, query *PrometheusQuery) string {
	if query.LegendFormat == "" {
		return metric.String()
	}

	result := legendFormat.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		labelName := strings.Replace(string(in), "{{", "", 1)
		labelName = strings.Replace(labelName, "}}", "", 1)
		labelName = strings.TrimSpace(labelName)
		if val, exists := metric[pmodel.LabelName(labelName)]; exists {
			return []byte(val)
		}

		return in
	})

	return string(result)
}

func parseQuery(queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) (*PrometheusQuery, error) {
	queryModel := queries[0]

	expr, err := queryModel.Model.Get("expr").String()
	if err != nil {
		return nil, err
	}

	step, err := queryModel.Model.Get("step").Int64()
	if err != nil {
		return nil, err
	}

	format := queryModel.Model.Get("legendFormat").MustString("")

	start, err := queryContext.TimeRange.ParseFrom()
	if err != nil {
		return nil, err
	}

	end, err := queryContext.TimeRange.ParseTo()
	if err != nil {
		return nil, err
	}

	return &PrometheusQuery{
		Expr:         expr,
		Step:         time.Second * time.Duration(step),
		LegendFormat: format,
		Start:        start,
		End:          end,
	}, nil
}

func parseResponse(value pmodel.Value, query *PrometheusQuery) (map[string]*tsdb.QueryResult, error) {
	queryResults := make(map[string]*tsdb.QueryResult)
	queryRes := tsdb.NewQueryResult()

	data, ok := value.(pmodel.Matrix)
	if !ok {
		return queryResults, fmt.Errorf("Unsupported result format: %s", value.Type().String())
	}

	for _, v := range data {
		series := tsdb.TimeSeries{
			Name: formatLegend(v.Metric, query),
		}

		for _, k := range v.Values {
			series.Points = append(series.Points, tsdb.NewTimePoint(null.FloatFrom(float64(k.Value)), float64(k.Timestamp.Unix()*1000)))
		}

		queryRes.Series = append(queryRes.Series, &series)
	}

	queryResults["A"] = queryRes
	return queryResults, nil
}
