package opentsdb

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckHealth(t *testing.T) {
	tests := []struct {
		name            string
		httpStatusCode  int
		expectedStatus  backend.HealthStatus
		expectedMessage string
	}{
		{
			name:            "successful health check",
			httpStatusCode:  200,
			expectedStatus:  backend.HealthStatusOk,
			expectedMessage: "Data source is working",
		},
		{
			name:            "http error",
			httpStatusCode:  500,
			expectedStatus:  backend.HealthStatusError,
			expectedMessage: "OpenTSDB suggest endpoint returned status 500",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/api/suggest", r.URL.Path)
				assert.Equal(t, "cpu", r.URL.Query().Get("q"))
				assert.Equal(t, "metrics", r.URL.Query().Get("type"))
				w.WriteHeader(tt.httpStatusCode)
			}))
			defer server.Close()

			pluginCtx := backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					URL:      server.URL,
					JSONData: []byte(`{}`),
				},
			}

			im := datasource.NewInstanceManager(newInstanceSettings(httpclient.NewProvider()))
			service := &Service{im: im}
			ctx := backend.WithPluginContext(context.Background(), pluginCtx)
			result, err := service.CheckHealth(ctx, &backend.CheckHealthRequest{
				PluginContext: pluginCtx,
			})

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedStatus, result.Status)
			assert.Contains(t, result.Message, tt.expectedMessage)
		})
	}
}

func TestBuildMetric(t *testing.T) {
	t.Run("Metric with no downsampleInterval should use query interval", func(t *testing.T) {
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
			Interval: 30 * time.Second,
		}

		metric := BuildMetric(query)
		require.Equal(t, "30s-avg", metric["downsample"], "should use query interval formatted as seconds")
	})

	t.Run("Metric with downsampleInterval converts decimal seconds to milliseconds", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": false,
						"downsampleInterval": "0.5s",
						"downsampleAggregator": "avg",
						"downsampleFillPolicy": "none"
					}`,
			),
		}

		metric := BuildMetric(query)
		require.Equal(t, "500ms-avg", metric["downsample"], "should convert 0.5s to 500ms")
	})

	t.Run("Metric with no downsampleInterval uses milliseconds for sub-second query interval", func(t *testing.T) {
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
			Interval: 500 * time.Millisecond,
		}

		metric := BuildMetric(query)
		require.Equal(t, "500ms-avg", metric["downsample"], "should use query interval formatted as milliseconds")
	})

	t.Run("Metric with no downsampleInterval uses minutes for longer intervals", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": false,
						"downsampleInterval": "",
						"downsampleAggregator": "sum",
						"downsampleFillPolicy": "none"
					}`,
			),
			Interval: 5 * time.Minute,
		}

		metric := BuildMetric(query)
		require.Equal(t, "5m-sum", metric["downsample"], "should use query interval formatted as minutes")
	})

	t.Run("Metric with no downsampleInterval uses hours for multi-hour intervals", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": false,
						"downsampleInterval": "",
						"downsampleAggregator": "max",
						"downsampleFillPolicy": "none"
					}`,
			),
			Interval: 2 * time.Hour,
		}

		metric := BuildMetric(query)
		require.Equal(t, "2h-max", metric["downsample"], "should use query interval formatted as hours")
	})

	t.Run("Metric with no downsampleInterval uses days for multi-day intervals", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": false,
						"downsampleInterval": "",
						"downsampleAggregator": "min",
						"downsampleFillPolicy": "none"
					}`,
			),
			Interval: 48 * time.Hour,
		}

		metric := BuildMetric(query)
		require.Equal(t, "2d-min", metric["downsample"], "should use query interval formatted as days")
	})

	t.Run("Build metric with explicitTags enabled", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": true,
						"explicitTags": true,
						"tags": {
							"host": "server01"
						}
					}`,
			),
		}

		metric := BuildMetric(query)
		require.True(t, metric["explicitTags"].(bool), "explicitTags should be true")

		metricTags := metric["tags"].(map[string]any)
		require.Equal(t, "server01", metricTags["host"])
	})

	t.Run("Build metric with explicitTags disabled does not include explicitTags", func(t *testing.T) {
		query := backend.DataQuery{
			JSON: []byte(`
					{
						"metric": "cpu.average.percent",
						"aggregator": "avg",
						"disableDownsampling": true,
						"explicitTags": false,
						"tags": {
							"host": "server01"
						}
					}`,
			),
		}

		metric := BuildMetric(query)
		require.Nil(t, metric["explicitTags"], "explicitTags should not be present when false")
	})
}

func TestOpenTsdbExecutor(t *testing.T) {
	t.Run("create request", func(t *testing.T) {
		req, err := CreateRequest(context.Background(), logger, &datasourceInfo{}, OpenTsdbQuery{})
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
		result, err := ParseResponse(logger, &http.Response{Body: io.NopCloser(strings.NewReader(response))}, "A", tsdbVersion)
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
			Custom:      map[string]any{"tagKeys": []string{"app", "env"}},
		}
		testFrame.RefID = "A"
		tsdbVersion := float32(4)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := ParseResponse(logger, &resp, "A", tsdbVersion)
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
			Custom:      map[string]any{"tagKeys": []string{"app", "env"}},
		}
		testFrame.RefID = "A"
		tsdbVersion := float32(3)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := ParseResponse(logger, &resp, "A", tsdbVersion)
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
			Custom:      map[string]any{"tagKeys": []string{"app", "env"}},
		}
		testFrame.RefID = "A"
		tsdbVersion := float32(3)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := ParseResponse(logger, &resp, "A", tsdbVersion)
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
			Custom:      map[string]any{"tagKeys": []string{"app", "env"}},
		}
		testFrame.RefID = myRefid

		tsdbVersion := float32(4)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := ParseResponse(logger, &resp, myRefid, tsdbVersion)
		require.NoError(t, err)

		if diff := cmp.Diff(testFrame, result.Responses[myRefid].Frames[0], data.FrameTestCompareOptions()...); diff != "" {
			t.Errorf("Result mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("tagKeys are returned sorted alphabetically in frame metadata", func(t *testing.T) {
		response := `
		[
			{
				"metric": "cpu.usage",
				"dps": [
					[1405544146, 75.5]
				],
				"tags" : {
					"zone": "us-east-1",
					"host": "server01",
					"app": "api",
					"env": "production"
				}
			}
		]`

		tsdbVersion := float32(4)

		resp := http.Response{Body: io.NopCloser(strings.NewReader(response))}
		resp.StatusCode = 200
		result, err := ParseResponse(logger, &resp, "A", tsdbVersion)
		require.NoError(t, err)

		frame := result.Responses["A"].Frames[0]
		require.NotNil(t, frame.Meta, "frame metadata should not be nil")
		require.NotNil(t, frame.Meta.Custom, "frame custom metadata should not be nil")

		customMeta, ok := frame.Meta.Custom.(map[string]any)
		require.True(t, ok, "custom metadata should be a map")

		tagKeys, ok := customMeta["tagKeys"].([]string)
		require.True(t, ok, "tagKeys should be present and be a string slice")
		require.Len(t, tagKeys, 4, "should have 4 tag keys")

		expectedTagKeys := []string{"app", "env", "host", "zone"}
		require.Equal(t, expectedTagKeys, tagKeys, "tagKeys should be sorted alphabetically")
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

		metric := BuildMetric(query)

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

		metric := BuildMetric(query)

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

		metric := BuildMetric(query)

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

		metric := BuildMetric(query)

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

		metric := BuildMetric(query)

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
						"counterMax": "45",
						"counterResetValue": "60",
						"tags": {
							"env": "prod",
							"app": "grafana"
						}
					}`,
			),
		}

		metric := BuildMetric(query)
		t.Log(metric)

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
			RefID:     "A",
			JSON:      []byte(`{"metric":"mA","aggregator":"avg"}`),
			TimeRange: backend.TimeRange{From: time.Unix(1000, 0), To: time.Unix(2000, 0)},
		}
		qB := backend.DataQuery{
			RefID:     "B",
			JSON:      []byte(`{"metric":"mB","aggregator":"avg"}`),
			TimeRange: backend.TimeRange{From: time.Unix(3000, 0), To: time.Unix(4000, 0)},
		}

		var bodies []string
		hits := 0 // count how many times the test server was hit
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			b, _ := io.ReadAll(r.Body)
			_ = r.Body.Close()
			bodies = append(bodies, string(b))
			hits++

			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`[]`))
		}))
		t.Cleanup(srv.Close)

		service := &Service{
			im: datasource.NewInstanceManager(newInstanceSettings(httpclient.NewProvider())),
		}

		settings := &backend.DataSourceInstanceSettings{
			UID:      "opentsdb-test",
			URL:      srv.URL,
			JSONData: []byte(`{"tsdbVersion":4,"httpMethod":"post"}`),
		}

		req := backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: settings,
			},
			Queries: []backend.DataQuery{qA, qB},
		}
		_, err := service.QueryData(context.Background(), &req)
		require.NoError(t, err)

		require.Equal(t, 2, hits)
		require.Len(t, bodies, 2)

		require.Contains(t, bodies[0], `"start":1000`)
		require.Contains(t, bodies[0], `"end":2000`)
		require.Contains(t, bodies[1], `"start":3000`)
		require.Contains(t, bodies[1], `"end":4000`)
	})
}
