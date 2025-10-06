package graphite

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
)

func TestProcessQuery(t *testing.T) {
	service := &Service{
		logger: backend.Logger,
	}
	t.Run("Parses single valid query", func(t *testing.T) {
		queries := []backend.DataQuery{
			{
				RefID: "A",
				JSON: []byte(`{
					"target": "app.grafana.*.dashboards.views.1M.count"
				}`),
			},
		}
		target, jsonModel, isMetricTank, err := service.processQuery(queries[0])
		assert.NoError(t, err)
		assert.Nil(t, jsonModel)
		assert.Equal(t, "app.grafana.*.dashboards.views.1M.count", target)
		assert.False(t, isMetricTank)
	})

	t.Run("Returns if target is empty", func(t *testing.T) {
		queries := []backend.DataQuery{
			{
				RefID: "A",
				JSON: []byte(`{
					"target": ""
				}`),
			},
		}
		emptyQuery := GraphiteQuery{Target: ""}
		target, jsonModel, isMetricTank, err := service.processQuery(queries[0])
		assert.NoError(t, err)
		assert.Equal(t, &emptyQuery, jsonModel)
		assert.Equal(t, "", target)
		assert.False(t, isMetricTank)
	})

	t.Run("Returns isMetricTank value", func(t *testing.T) {
		queries := []backend.DataQuery{
			{
				RefID: "A",
				JSON: []byte(`{
					"target": "app.grafana.*.dashboards.views.1M.count",
					"isMetricTank": true
				}`),
			},
		}
		_, _, isMetricTank, err := service.processQuery(queries[0])
		assert.NoError(t, err)
		assert.True(t, isMetricTank)
	})

	t.Run("QueryData with no valid queries returns bad request response", func(t *testing.T) {
		queries := []backend.DataQuery{
			{
				RefID: "A",
				JSON: []byte(`{
					"query": "app.grafana.*.dashboards.views.1M.count"
				}`),
			},
			{
				RefID: "B",
				JSON: []byte(`{
					"query": "app.grafana.*.dashboards.views.1M.count"
				}`),
			},
		}

		service := ProvideService(httpclient.NewProvider(), noop.NewTracerProvider().Tracer("graphite-tests"))

		rsp, err := service.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID:  0,
					URL: "http://localhost",
				},
			},
			Queries: queries,
		})
		assert.NoError(t, err)
		expectedResponse := backend.ErrDataResponseWithSource(400, backend.ErrorSourceDownstream, "no query target found")
		assert.Equal(t, expectedResponse, rsp.Responses["A"])
	})

	t.Run("QueryData with no queries returns an error", func(t *testing.T) {
		service := &Service{
			logger: backend.Logger,
		}

		rsp, err := service.QueryData(context.Background(), &backend.QueryDataRequest{})
		assert.Nil(t, rsp)
		assert.Error(t, err)
	})

	t.Run("QueryData happy path with service provider and plugin context", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, err := w.Write([]byte(`[
				{
					"target": "target A",
					"tags": { "fooTag": "fooValue", "barTag": "barValue", "int": 100, "float": 3.14 },
					"datapoints": [[50, 1], [null, 2], [100, 3]]
				}	
			]`))
			require.NoError(t, err)
		}))
		t.Cleanup(server.Close)

		service := ProvideService(httpclient.NewProvider(), noop.NewTracerProvider().Tracer("graphite-tests"))

		queries := []backend.DataQuery{
			{
				RefID: "A",
				JSON: []byte(`{
					"target": "app.grafana.*.dashboards.views.1M.count"
				}`),
			},
			{
				RefID: "B",
				JSON: []byte(`{
					"query": "app.grafana.*.dashboards.views.1M.count"
				}`),
			},
		}

		rsp, err := service.QueryData(context.Background(), &backend.QueryDataRequest{
			PluginContext: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					ID:  0,
					URL: server.URL,
				},
			},
			Queries: queries,
		})
		assert.NoError(t, err)
		assert.NotNil(t, rsp)
	})
}

func TestConvertResponses(t *testing.T) {
	service := &Service{
		logger: backend.Logger,
	}

	t.Run("Converts response without tags to data frames", func(*testing.T) {
		body := `
		[
			{
				"target": "target",
				"datapoints": [[50, 1], [null, 2], [100, 3]]
			}
		]`
		a := 50.0
		b := 100.0
		refId := "A"
		expectedFrame := data.NewFrame("A",
			data.NewField("time", nil, []time.Time{time.Unix(1, 0).UTC(), time.Unix(2, 0).UTC(), time.Unix(3, 0).UTC()}),
			data.NewField("value", data.Labels{}, []*float64{&a, nil, &b}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "target"}),
		).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})
		expectedFrames := data.Frames{expectedFrame}

		httpResponse := &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}
		dataFrames, err := service.toDataFrames(httpResponse, refId)

		require.NoError(t, err)
		if !reflect.DeepEqual(expectedFrames, dataFrames) {
			expectedFramesJSON, _ := json.Marshal(expectedFrames)
			dataFramesJSON, _ := json.Marshal(dataFrames)
			t.Errorf("Data frames should have been equal but was, expected:\n%s\nactual:\n%s", expectedFramesJSON, dataFramesJSON)
		}
	})

	t.Run("Converts response with tags to data frames", func(*testing.T) {
		body := `
		[
			{
				"target": "target",
				"tags": { "fooTag": "fooValue", "barTag": "barValue", "int": 100, "float": 3.14 },
				"datapoints": [[50, 1], [null, 2], [100, 3]]
			}
		]`
		a := 50.0
		b := 100.0
		refId := "A"
		expectedFrame := data.NewFrame("A",
			data.NewField("time", nil, []time.Time{time.Unix(1, 0).UTC(), time.Unix(2, 0).UTC(), time.Unix(3, 0).UTC()}),
			data.NewField("value", data.Labels{
				"fooTag": "fooValue",
				"barTag": "barValue",
				"int":    "100",
				"float":  "3.14",
			}, []*float64{&a, nil, &b}).SetConfig(&data.FieldConfig{DisplayNameFromDS: "target"}),
		).SetMeta(&data.FrameMeta{Type: data.FrameTypeTimeSeriesMulti})
		expectedFrames := data.Frames{expectedFrame}

		httpResponse := &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(body))}
		dataFrames, err := service.toDataFrames(httpResponse, refId)

		require.NoError(t, err)
		if !reflect.DeepEqual(expectedFrames, dataFrames) {
			expectedFramesJSON, _ := json.Marshal(expectedFrames)
			dataFramesJSON, _ := json.Marshal(dataFrames)
			t.Errorf("Data frames should have been equal but was, expected:\n%s\nactual:\n%s", expectedFramesJSON, dataFramesJSON)
		}
	})
}

func TestFixIntervalFormat(t *testing.T) {
	testCases := []struct {
		name     string
		target   string
		expected string
	}{
		{
			name:     "should transform 1m to graphite unit (1min) when used as interval string",
			target:   "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1m'), 4)",
			expected: "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1min'), 4)",
		},
		{
			name:     "should transform 1M to graphite unit (1mon) when used as interval string",
			target:   "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1M'), 4)",
			expected: "aliasByNode(hitcount(averageSeries(app.grafana.*.dashboards.views.count), '1mon'), 4)",
		},
		{
			name:     "should not transform 1m when not used as interval string",
			target:   "app.grafana.*.dashboards.views.1m.count",
			expected: "app.grafana.*.dashboards.views.1m.count",
		},
		{
			name:     "should not transform 1M when not used as interval string",
			target:   "app.grafana.*.dashboards.views.1M.count",
			expected: "app.grafana.*.dashboards.views.1M.count",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			tr := fixIntervalFormat(tc.target)
			assert.Equal(t, tc.expected, tr)
		})
	}
}

func TestRunQueryE2E(t *testing.T) {
	tests := []struct {
		name            string
		serverResponse  string
		serverStatus    int
		queries         []backend.DataQuery
		expectError     bool
		errorContains   string
		multipleTargets map[string]string
	}{
		{
			name:         "successful single query with data",
			serverStatus: 200,
			serverResponse: `[
				{
					"target": "stats.counters.web.hits",
					"datapoints": [[100, 1609459200], [150, 1609459260], [120, 1609459320]]
				}
			]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459320, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
			},
			expectError: false,
		},
		{
			name:         "successful single query with null values",
			serverStatus: 200,
			serverResponse: `[
				{
					"target": "stats.counters.web.hits",
					"datapoints": [[100, 1609459200], [null, 1609459260], [120, 1609459320]]
				}
			]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459320, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
			},
			expectError: false,
		},
		{
			name:         "successful single query with tags",
			serverStatus: 200,
			serverResponse: `[
				{
					"target": "stats.counters.web.hits",
					"tags": {
						"host": "server1",
						"environment": "production",
						"port": 8080,
						"rate": 99.5
					},
					"datapoints": [[100, 1609459200], [150, 1609459260]]
				}
			]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
			},
			expectError: false,
		},
		{
			name:         "successful multiple queries",
			serverStatus: 200,
			multipleTargets: map[string]string{
				"stats.counters.web.hits": `[
					{
						"target": "stats.counters.web.hits",
						"datapoints": [[100, 1609459200], [150, 1609459260]]
					}
				]`,
				"stats.counters.api.calls": `[
					{
						"target": "stats.counters.api.calls",
						"datapoints": [[50, 1609459200], [75, 1609459260]]
					}
				]`,
			},
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
				{
					RefID: "B",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.api.calls"
					}`),
				},
			},
			expectError: false,
		},
		{
			name:           "query with empty target",
			serverStatus:   200,
			serverResponse: `[]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": ""
					}`),
				},
			},
			expectError:   true,
			errorContains: "no query target found",
		},
		{
			name:         "mixed queries - some empty, some valid",
			serverStatus: 200,
			serverResponse: `[
				{
					"target": "stats.counters.web.hits",
					"datapoints": [[100, 1609459200], [150, 1609459260]]
				}
			]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": ""
					}`),
				},
				{
					RefID: "B",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
			},
			expectError: false,
		},
		{
			name:           "server error response",
			serverStatus:   500,
			serverResponse: `{"error": "Internal server error"}`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
			},
			expectError:   true,
			errorContains: "request failed with error",
		},
		{
			name:         "server error response with HTML content",
			serverStatus: 500,
			serverResponse: `<body>
<h1>Internal Server Error</h1>
<p>The server encountered an unexpected condition that prevented it from fulfilling the request.</p>
<div>Error: Invalid metric path &#39;stats.invalid.metric&#39;</div>
Error: Target not found
</body>`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.invalid.metric"
					}`),
				},
			},
			expectError:   true,
			errorContains: "Error: Target not found", // Should parse HTML and extract the last meaningful line
		},
		{
			name:           "malformed JSON response",
			serverStatus:   200,
			serverResponse: `[{invalid json}]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "stats.counters.web.hits"
					}`),
				},
			},
			expectError: true,
		},
		{
			name:           "invalid query JSON",
			serverStatus:   200,
			serverResponse: `[]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON:          []byte(`{invalid json}`),
				},
			},
			expectError:   true,
			errorContains: "failed to decode the Graphite query",
		},
		{
			name:         "interval format transformation",
			serverStatus: 200,
			serverResponse: `[
				{
					"target": "hitcount(stats.counters.web.hits, '1min')",
					"datapoints": [[100, 1609459200], [150, 1609459260]]
				}
			]`,
			queries: []backend.DataQuery{
				{
					RefID: "A",
					TimeRange: backend.TimeRange{
						From: time.Unix(1609459200, 0),
						To:   time.Unix(1609459260, 0),
					},
					MaxDataPoints: 1000,
					JSON: []byte(`{
						"target": "hitcount(stats.counters.web.hits, '1m')"
					}`),
				},
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			testName := strings.ReplaceAll(tt.name, " ", "_")

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				err := r.ParseForm()
				require.NoError(t, err)

				// Choose response based on target for multiple queries
				response := tt.serverResponse
				if tt.multipleTargets != nil {
					target := r.FormValue("target")
					if targetResponse, ok := tt.multipleTargets[target]; ok {
						response = targetResponse
					}
				}

				if !strings.Contains(tt.name, "empty target") {
					assert.NotEmpty(t, r.FormValue("target"))
				}

				w.WriteHeader(tt.serverStatus)
				_, err = w.Write([]byte(response))
				require.NoError(t, err)
			}))
			defer server.Close()

			dsInfo := &datasourceInfo{
				Id:         1,
				URL:        server.URL,
				HTTPClient: &http.Client{},
			}

			service := &Service{
				logger: backend.Logger,
			}

			req := &backend.QueryDataRequest{
				PluginContext: backend.PluginContext{
					DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
						ID:  1,
						URL: server.URL,
					},
					OrgID: 1,
				},
				Queries: tt.queries,
			}

			result, err := service.RunQuery(context.Background(), req, dsInfo)

			if tt.expectError {
				if err != nil {
					if tt.errorContains != "" {
						assert.Contains(t, err.Error(), tt.errorContains)
					}
				} else {
					require.NotNil(t, result)
					found := false
					for _, resp := range result.Responses {
						if resp.Error != nil {
							found = true
							if tt.errorContains != "" {
								assert.Contains(t, resp.Error.Error(), tt.errorContains)
							}
							break
						}
					}
					assert.True(t, found, "Expected error but none found")
				}
			} else {
				assert.NoError(t, err)
				require.NotNil(t, result)

				for refID, resp := range result.Responses {
					experimental.CheckGoldenJSONResponse(t, "testdata", fmt.Sprintf("%s-RefID-%s.golden", testName, refID), &resp, false)
				}
			}
		})
	}
}

func TestParseGraphiteError(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		body     string
		expected string
	}{
		{
			name:     "simple text error",
			status:   400,
			body:     "Bad request: invalid target",
			expected: "Bad request: invalid target",
		},
		{
			name:     "JSON error",
			status:   400,
			body:     `{"error": "Invalid target format"}`,
			expected: `{"error": "Invalid target format"}`,
		},
		{
			name:     "HTML error",
			status:   500,
			body:     `<body><h1>Internal Server Error</h1><p>Target not found</p></body>`,
			expected: "Internal Server Error\nTarget not found",
		},
		{
			name:   "complex HTML error",
			status: 500,
			body: `<body>
<h1>Internal Server Error</h1>
<p>The server encountered an unexpected condition that prevented it from fulfilling the request.</p>
<div>Error: Invalid metric path &#39;stats.invalid.metric&#39;</div>
Final error message here
</body>`,
			expected: "Internal Server Error\nThe server encountered an unexpected condition that prevented it from fulfilling the request.\nError: Invalid metric path 'stats.invalid.metric'\nFinal error message here",
		},
		{
			name:     "HTML error with unicode",
			status:   500,
			body:     `<body><p>Error: Invalid path &#x27;test&#x27; and &#x22;value&#x22;</p></body>`,
			expected: "Error: Invalid path 'test' and \"value\"",
		},
		{
			name:   "HTML with whitespace and newlines",
			status: 500,
			body: `<body>

		<h1>Error</h1>

		<p>Something went wrong</p>

		Critical failure occurred

		</body>`,
			expected: "Error\nSomething went wrong\nCritical failure occurred",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseGraphiteError(tt.status, tt.body)
			assert.Equal(t, tt.expected, result)
		})
	}
}
