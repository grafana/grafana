package prometheus

import (
	"context"
	"fmt"
	"net/http"
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
	plog       log.Logger
	HttpClient http.Client
)

func init() {
	plog = log.New("tsdb.prometheus")
	tsdb.RegisterExecutor("prometheus", NewPrometheusExecutor)
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
	reg, _ := regexp.Compile(`\{\{\s*(.+?)\s*\}\}`)

	result := reg.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		ind := strings.Replace(strings.Replace(string(in), "{{", "", 1), "}}", "", 1)
		if val, exists := metric[pmodel.LabelName(ind)]; exists {
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

	format, err := queryModel.Model.Get("legendFormat").String()
	if err != nil {
		return nil, err
	}

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

/*
func resultWithError(result *tsdb.BatchResult, err error) *tsdb.BatchResult {
	result.Error = err
	return result
}*/
