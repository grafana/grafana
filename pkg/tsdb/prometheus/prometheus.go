package prometheus

import (
	"context"
	"net/http"
	"time"

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

func (e *PrometheusExecutor) Execute(queries tsdb.QuerySlice, queryContext *tsdb.QueryContext) *tsdb.BatchResult {
	result := &tsdb.BatchResult{}

	client, err := e.getClient()
	if err != nil {
		result.Error = err
		return result
	}

	from, _ := queryContext.TimeRange.FromTime()
	to, _ := queryContext.TimeRange.ToTime()
	timeRange := prometheus.Range{
		Start: from,
		End:   to,
		Step:  time.Second,
	}

	ctx := context.Background()
	value, err := client.QueryRange(ctx, "counters_logins", timeRange)

	if err != nil {
		result.Error = err
		return result
	}

	result.QueryResults = parseResponse(value)
	return result
}

func parseResponse(value pmodel.Value) map[string]*tsdb.QueryResult {
	queryResults := make(map[string]*tsdb.QueryResult)
	queryRes := &tsdb.QueryResult{}

	data := value.(pmodel.Matrix)

	for _, v := range data {
		var points [][2]*float64
		for _, k := range v.Values {
			dummie := float64(k.Timestamp)
			d2 := float64(k.Value)
			points = append(points, [2]*float64{&d2, &dummie})
		}

		queryRes.Series = append(queryRes.Series, &tsdb.TimeSeries{
			Name:   v.Metric.String(),
			Points: points,
		})
	}

	queryResults["A"] = queryRes
	return queryResults
}
