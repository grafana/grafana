package api

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/metrics"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/util"
)

func GetTestMetrics(c *middleware.Context) Response {
	from := c.QueryInt64("from")
	to := c.QueryInt64("to")
	maxDataPoints := c.QueryInt64("maxDataPoints")
	stepInSeconds := (to - from) / maxDataPoints

	result := dtos.MetricQueryResultDto{}
	result.Data = make([]dtos.MetricQueryResultDataDto, 1)

	for seriesIndex := range result.Data {
		points := make([][2]float64, maxDataPoints)
		walker := rand.Float64() * 100
		time := from

		for i := range points {
			points[i][0] = walker
			points[i][1] = float64(time)
			walker += rand.Float64() - 0.5
			time += stepInSeconds
		}

		result.Data[seriesIndex].Target = "test-series-" + strconv.Itoa(seriesIndex)
		result.Data[seriesIndex].DataPoints = points
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
