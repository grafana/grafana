package prometheus

import (
	"context"
	"net/http"
	"regexp"
	"strings"
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

	query := parseQuery(queries)

	timeRange := prometheus.Range{
		Start: from,
		End:   to,
		Step:  query.Step,
	}

	value, err := client.QueryRange(context.Background(), query.Expr, timeRange)

	if err != nil {
		result.Error = err
		return result
	}

	result.QueryResults = parseResponse(value, query)
	return result
}

func formatLegend(metric pmodel.Metric, query PrometheusQuery) string {
	r, _ := regexp.Compile(`\{\{\s*(.+?)\s*\}\}`)

	result := r.ReplaceAllFunc([]byte(query.LegendFormat), func(in []byte) []byte {
		ind := strings.Replace(strings.Replace(string(in), "{{", "", 1), "}}", "", 1)
		if val, exists := metric[pmodel.LabelName(ind)]; exists {
			return []byte(val)
		}

		return in
	})

	return string(result)
}

func parseQuery(queries tsdb.QuerySlice) PrometheusQuery {
	queryModel := queries[0]

	return PrometheusQuery{
		Expr:         queryModel.Model.Get("expr").MustString(),
		Step:         time.Second * time.Duration(queryModel.Model.Get("step").MustInt64(1)),
		LegendFormat: queryModel.Model.Get("legendFormat").MustString(),
	}
}

func parseResponse(value pmodel.Value, query PrometheusQuery) map[string]*tsdb.QueryResult {
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
			Name:   formatLegend(v.Metric, query),
			Points: points,
		})
	}

	queryResults["A"] = queryRes
	return queryResults
}
