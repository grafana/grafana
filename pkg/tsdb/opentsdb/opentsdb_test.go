package opentsdb

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOpenTsdbExecutor(t *testing.T) {
	service := &Service{}

	t.Run("create request", func(t *testing.T) {
		req, err := service.createRequest(context.Background(), logger, &datasourceInfo{}, OpenTsdbQuery{})
		require.NoError(t, err)

		assert.Equal(t, "POST", req.Method)
		body, err := io.ReadAll(req.Body)
		require.NoError(t, err)

		testBody := "{\"start\":0,\"end\":0,\"queries\":null}"
		assert.Equal(t, testBody, string(body))
	})

	t.Run("Parse response should handle invalid JSON", func(t *testing.T) {
		response := `{ invalid }`

		tsdbVersion := float32(4)
		result, err := service.parseResponse(logger, &http.Response{Body: io.NopCloser(strings.NewReader(response))}, "A", tsdbVersion)
		require.Nil(t, result)
		require.Error(t, err)
	})

	t.Run("Parse response should handle JSON (v2.4 and above)", func(t *testing.T) {
		response := `
		[
			{
				"metric": "test",
				"dps": [
					[1405544146, 50.0]
				],
				"tags" : {
					"env": "prod",
					"app": "grafana"
				}
			}
		]`

		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{
				time.Date(2014, 7, 16, 20, 55, 46, 0, time.UTC),
			}),
			data.NewField("test", map[string]string{"env": "prod", "app": "grafana"}, []float64{
				50}),
		)
		testFrame.Meta = &data.FrameMeta{
			Type:        data.FrameTypeTimeSeriesMulti,
			TypeVersion: data.FrameTypeVersion{0, 1},
		}
		testFrame.RefID = "A"
		tsdbVersion := float32(4)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := service.parseResponse(logger, &resp, "A", tsdbVersion)
		require.NoError(t, err)

		frame := result.Responses["A"]

		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Parse response should handle JSON (v2.3 and below)", func(t *testing.T) {
		response := `
		[
			{
				"metric": "test",
				"dps": {
					"1405544146": 50.0
				},
				"tags" : {
					"env": "prod",
					"app": "grafana"
				}
			}
		]`

		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{
				time.Date(2014, 7, 16, 20, 55, 46, 0, time.UTC),
			}),
			data.NewField("test", map[string]string{"env": "prod", "app": "grafana"}, []float64{
				50}),
		)
		testFrame.Meta = &data.FrameMeta{
			Type:        data.FrameTypeTimeSeriesMulti,
			TypeVersion: data.FrameTypeVersion{0, 1},
		}
		testFrame.RefID = "A"
		tsdbVersion := float32(3)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := service.parseResponse(logger, &resp, "A", tsdbVersion)
		require.NoError(t, err)

		frame := result.Responses["A"]

		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Parse response should handle unordered JSON (v2.3 and below)", func(t *testing.T) {
		response := `
		[
			{
				"metric": "test",
				"dps": {
					"1405094109": 55.0,
					"1405124146": 124.0,
					"1405124212": 1284.0,
					"1405019246": 50.0,
					"1408352146": 812.0,
					"1405534153": 153.0,
					"1405124397": 9035.0,
					"1401234774": 215.0,
					"1409712532": 356.0,
					"1491523811": 8953.0,
					"1405239823": 258.0
				},
				"tags" : {
					"env": "prod",
					"app": "grafana"
				}
			}
		]`

		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{
				time.Date(2014, 5, 27, 23, 52, 54, 0, time.UTC),
				time.Date(2014, 7, 10, 19, 7, 26, 0, time.UTC),
				time.Date(2014, 7, 11, 15, 55, 9, 0, time.UTC),
				time.Date(2014, 7, 12, 0, 15, 46, 0, time.UTC),
				time.Date(2014, 7, 12, 0, 16, 52, 0, time.UTC),
				time.Date(2014, 7, 12, 0, 19, 57, 0, time.UTC),
				time.Date(2014, 7, 13, 8, 23, 43, 0, time.UTC),
				time.Date(2014, 7, 16, 18, 9, 13, 0, time.UTC),
				time.Date(2014, 8, 18, 8, 55, 46, 0, time.UTC),
				time.Date(2014, 9, 3, 2, 48, 52, 0, time.UTC),
				time.Date(2017, 4, 7, 0, 10, 11, 0, time.UTC),
			}),
			data.NewField("test", map[string]string{"env": "prod", "app": "grafana"}, []float64{
				215,
				50,
				55,
				124,
				1284,
				9035,
				258,
				153,
				812,
				356,
				8953,
			}),
		)
		testFrame.Meta = &data.FrameMeta{
			Type:        data.FrameTypeTimeSeriesMulti,
			TypeVersion: data.FrameTypeVersion{0, 1},
		}
		testFrame.RefID = "A"
		tsdbVersion := float32(3)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := service.parseResponse(logger, &resp, "A", tsdbVersion)
		require.NoError(t, err)

		frame := result.Responses["A"]

		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("ref id is not hard coded", func(t *testing.T) {
		myRefid := "reference id"

		response := `
		[
			{
				"metric": "test",
				"dps": [
					[1405544146, 50.0]
				],
				"tags" : {
					"env": "prod",
					"app": "grafana"
				}
			}
		]`

		testFrame := data.NewFrame("test",
			data.NewField("Time", nil, []time.Time{
				time.Date(2014, 7, 16, 20, 55, 46, 0, time.UTC),
			}),
			data.NewField("test", map[string]string{"env": "prod", "app": "grafana"}, []float64{
				50}),
		)
		testFrame.Meta = &data.FrameMeta{
			Type:        data.FrameTypeTimeSeriesMulti,
			TypeVersion: data.FrameTypeVersion{0, 1},
		}
		testFrame.RefID = myRefid

		tsdbVersion := float32(4)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := service.parseResponse(logger, &resp, myRefid, tsdbVersion)
		require.NoError(t, err)

		if diff := cmp.Diff(testFrame, result.Responses[myRefid].Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("Build metric with downsampling enabled", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": false,
						"downsampleInterval": "",
						"downsampleAggregator": "avg",
						"downsampleFillPolicy": "none"
					}`,
			),
		}

		metric := service.buildMetric(query)

		require.Len(t, metric, 3)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
		require.Equal(t, "1m-avg", metric["downsample"])
	})

	t.Run("Build metric with downsampling disabled", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": true,
						"downsampleInterval": "",
						"downsampleAggregator": "avg",
						"downsampleFillPolicy": "none"
					}`,
			),
		}

		metric := service.buildMetric(query)

		require.Len(t, metric, 2)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
	})

	t.Run("Build metric with downsampling enabled with params", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": false,
						"downsampleInterval": "5m",
						"downsampleAggregator": "sum",
						"downsampleFillPolicy": "null"
					}`,
			),
		}

		metric := service.buildMetric(query)

		require.Len(t, metric, 3)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
		require.Equal(t, "5m-sum-null", metric["downsample"])
	})

	t.Run("Build metric with tags with downsampling disabled", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": true,
						"downsampleInterval": "5m",
						"downsampleAggregator": "sum",
						"downsampleFillPolicy": "null",
						"tags": {
							"env": "prod",
							"app": "grafana"
						}
					}`,
			),
		}

		metric := service.buildMetric(query)

		require.Len(t, metric, 3)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])
		require.Nil(t, metric["downsample"])

		metricTags := metric["tags"].(map[string]any)
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])
	})

	t.Run("Build metric with rate enabled but counter disabled", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": true,
						"shouldComputeRate": true,
						"isCounter": false,
						"tags": {
							"env": "prod",
							"app": "grafana"
						}
					}`,
			),
		}

		metric := service.buildMetric(query)

		require.Len(t, metric, 5)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])

		metricTags := metric["tags"].(map[string]any)
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])

		require.True(t, metric["rate"].(bool))
		require.False(t, metric["rateOptions"].(map[string]any)["counter"].(bool))
	})

	t.Run("Build metric with rate and counter enabled", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": true,
						"shouldComputeRate": true,
						"isCounter": true,
						"counterMax": 45,
						"counterResetValue": 60,
						"tags": {
							"env": "prod",
							"app": "grafana"
						}
					}`,
			),
		}

		metric := service.buildMetric(query)

		require.Len(t, metric, 5)
		require.Equal(t, "cpu.average.percent", metric["metric"])
		require.Equal(t, "avg", metric["aggregator"])

		metricTags := metric["tags"].(map[string]any)
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])

		require.True(t, metric["rate"].(bool))
		metricRateOptions := metric["rateOptions"].(map[string]any)
		require.Len(t, metricRateOptions, 3)
		require.True(t, metricRateOptions["counter"].(bool))
		require.Equal(t, float64(45), metricRateOptions["counterMax"])
		require.Equal(t, float64(60), metricRateOptions["resetValue"])
	})

	t.Run("createRequest uses per-query time range", func(t *testing.T) {
		qA := backend.DataQuery{
			RefID: "A",
			JSON:  []byte(`{"metric": "m", "aggregator": "avg"}`),
			TimeRange: backend.TimeRange{
				From: time.Unix(1000, 0),
				To:   time.Unix(2000, 0),
			},
		}
		tsdbA := OpenTsdbQuery{
			Start:   qA.TimeRange.From.Unix(),
			End:     qA.TimeRange.To.Unix(),
			Queries: []map[string]any{service.buildMetric(qA)},
		}
		reqA, err := service.createRequest(context.Background(), logger, &datasourceInfo{URL: "http://x"}, tsdbA)
		require.NoError(t, err)
		bodyA, _ := io.ReadAll(reqA.Body)

		qB := backend.DataQuery{
			RefID: "B",
			JSON:  []byte(`{"metric": "m", "aggregator": "avg"}`),
			TimeRange: backend.TimeRange{
				From: time.Unix(3000, 0),
				To:   time.Unix(4000, 0),
			},
		}
		tsdbB := OpenTsdbQuery{
			Start:   qB.TimeRange.From.Unix(),
			End:     qB.TimeRange.To.Unix(),
			Queries: []map[string]any{service.buildMetric(qB)},
		}
		reqB, err := service.createRequest(context.Background(), logger, &datasourceInfo{URL: "http://x"}, tsdbB)
		require.NoError(t, err)
		bodyB, _ := io.ReadAll(reqB.Body)

		require.Contains(t, string(bodyA), `"start":1000`)
		require.Contains(t, string(bodyA), `"end":2000`)
		require.Contains(t, string(bodyB), `"start":3000`)
		require.Contains(t, string(bodyB), `"end":4000`)
	})

}
