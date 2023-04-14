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

		result, err := service.parseResponse(logger, &http.Response{Body: io.NopCloser(strings.NewReader(response))})
		require.Nil(t, result)
		require.Error(t, err)
	})

	t.Run("Parse response should handle JSON", func(t *testing.T) {
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
			data.NewField("time", nil, []time.Time{
				time.Date(2014, 7, 16, 20, 55, 46, 0, time.UTC),
			}),
			data.NewField("value", map[string]string{"env": "prod", "app": "grafana"}, []float64{
				50}),
		)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := service.parseResponse(logger, &resp)
		require.NoError(t, err)

		frame := result.Responses["A"]

		if diff := cmp.Diff(testFrame, frame.Frames[0], data.FrameTestCompareOptions()...); diff != "" {
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

		metricTags := metric["tags"].(map[string]interface{})
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

		metricTags := metric["tags"].(map[string]interface{})
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])

		require.True(t, metric["rate"].(bool))
		require.False(t, metric["rateOptions"].(map[string]interface{})["counter"].(bool))
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

		metricTags := metric["tags"].(map[string]interface{})
		require.Len(t, metricTags, 2)
		require.Equal(t, "prod", metricTags["env"])
		require.Equal(t, "grafana", metricTags["app"])
		require.Nil(t, metricTags["ip"])

		require.True(t, metric["rate"].(bool))
		metricRateOptions := metric["rateOptions"].(map[string]interface{})
		require.Len(t, metricRateOptions, 3)
		require.True(t, metricRateOptions["counter"].(bool))
		require.Equal(t, float64(45), metricRateOptions["counterMax"])
		require.Equal(t, float64(60), metricRateOptions["resetValue"])
	})
}
