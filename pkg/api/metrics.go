package api

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/util"
)

func GetTestMetrics(c *middleware.Context) Response {

	timeRange := tsdb.NewTimeRange(c.Query("from"), c.Query("to"))

	req := &tsdb.Request{
		TimeRange: timeRange,
		Queries: []*tsdb.Query{
			{
				RefId:         "A",
				MaxDataPoints: c.QueryInt64("maxDataPoints"),
				IntervalMs:    c.QueryInt64("intervalMs"),
				DataSource: &tsdb.DataSourceInfo{
					Name:     "Grafana TestDataDB",
					PluginId: "grafana-testdata-datasource",
				},
			},
		},
	}

	resp, err := tsdb.HandleRequest(req)
	if err != nil {
		return ApiError(500, "Metric request error", err)
	}

	result := dtos.MetricQueryResultDto{}

	for _, v := range resp.Results {
		if v.Error != nil {
			return ApiError(500, "tsdb.HandleRequest() response error", v.Error)
		}

		for _, series := range v.Series {
			result.Data = append(result.Data, series)
		}
	}

	return Json(200, &result)
}

func GetInternalMetrics(c *middleware.Context) Response {
	if metrics.UseNilMetrics {
		return Json(200, util.DynMap{"message": "Metrics disabled"})
	}

	snapshots := metrics.MetricStats.GetSnapshots()

	resp := make(map[string]interface{})

	for _, m := range snapshots {
		metricName := m.Name() + m.StringifyTags()

		switch metric := m.(type) {
		case metrics.Counter:
			resp[metricName] = map[string]interface{}{
				"count": metric.Count(),
			}
		case metrics.Timer:
			percentiles := metric.Percentiles([]float64{0.25, 0.75, 0.90, 0.99})
			resp[metricName] = map[string]interface{}{
				"count": metric.Count(),
				"min":   metric.Min(),
				"max":   metric.Max(),
				"mean":  metric.Mean(),
				"std":   metric.StdDev(),
				"p25":   percentiles[0],
				"p75":   percentiles[1],
				"p90":   percentiles[2],
				"p99":   percentiles[3],
			}
		}
	}

	var b []byte
	var err error
	if b, err = json.MarshalIndent(resp, "", " "); err != nil {
		return ApiError(500, "body json marshal", err)
	}

	return &NormalResponse{
		body:   b,
		status: 200,
		header: http.Header{
			"Content-Type": []string{"application/json"},
		},
	}
}

// Genereates a index out of range error
func GenerateError(c *middleware.Context) Response {
	var array []string
	return Json(200, array[20])
}
