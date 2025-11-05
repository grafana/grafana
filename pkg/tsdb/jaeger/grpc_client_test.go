package jaeger

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/status"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJaegerGrpcClient_Services(t *testing.T) {
	tests := []struct {
		name           string
		mockResponse   string
		mockStatusCode int
		mockStatus     string
		expectedResult []string
		expectError    bool
		expectedError  error
	}{
		{
			name:           "Successful response",
			mockResponse:   `{"services": ["service1", "service2"]}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"service1", "service2"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Non-200 response",
			mockResponse:   "",
			mockStatusCode: http.StatusInternalServerError,
			mockStatus:     "Internal Server Error",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  backend.DownstreamError(errors.New("Internal Server Error")),
		},
		{
			name:           "Invalid JSON response",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  status.ErrorWithSource{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			settings := backend.DataSourceInstanceSettings{
				URL: server.URL,
			}
			client, err := New(server.Client(), log.NewNullLogger(), settings)
			assert.NoError(t, err)

			services, err := client.GrpcServices()

			if tt.expectError {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.IsType(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, services)
			}
		})
	}
}

func TestJaegerGrpcClient_Trace(t *testing.T) {
	const successTraceResponse = `{
		"result": {
			"resourceSpans": [
				{
					"resource": {
						"attributes": [
							{
								"key": "service.name",
								"value": {
									"stringValue": "orders"
								}
							}
						]
					},
					"scopeSpans": [
						{
							"scope": {
								"name": "exampleScope",
								"version": "1.0.0"
							},
							"spans": [
								{
									"traceId": "abcd1234",
									"spanId": "abcd5678",
									"parentSpanId": "",
									"name": "GET /ready",
									"kind": 1,
									"startTimeUnixNano": "1000",
									"endTimeUnixNano": "2000",
									"attributes": [],
									"events": [],
									"links": [],
									"status": {
										"message": "",
										"code": 0
									}
								}
							]
						}
					],
					"schemaUrl": ""
				}
			]
		},
		"error": {
			"httpCode": 0,
			"message": "",
			"details": []
		}
	}`

	t.Run("requires non-empty traceID", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			URL:      "http://example.com",
			JSONData: []byte(`{}`),
		}

		client, err := New(http.DefaultClient, log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "", time.Time{}, time.Time{}, "A")
		assert.Nil(t, frame)
		assert.Error(t, err)
		assert.IsType(t, status.ErrorWithSource{}, err)
		assert.Contains(t, err.Error(), "traceID is empty")
	})

	t.Run("returns error when settings JSON is invalid", func(t *testing.T) {
		settings := backend.DataSourceInstanceSettings{
			URL:      "http://example.com",
			JSONData: []byte(`{"traceIdTimeParams":`),
		}

		client, err := New(http.DefaultClient, log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "trace-1", time.Time{}, time.Time{}, "A")
		assert.Nil(t, frame)
		assert.Error(t, err)
		assert.IsType(t, status.ErrorWithSource{}, err)
		assert.Contains(t, err.Error(), "failed to parse settings JSON data")
	})

	t.Run("propagates HTTP errors as downstream errors", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		settings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: []byte(`{}`),
		}

		client, err := New(server.Client(), log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "trace-1", time.Time{}, time.Time{}, "A")
		assert.Nil(t, frame)
		assert.Error(t, err)
		assert.IsType(t, status.ErrorWithSource{}, err)
	})

	t.Run("returns error when response body is invalid", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{invalid`))
		}))
		defer server.Close()

		settings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: []byte(`{}`),
		}

		client, err := New(server.Client(), log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "trace-1", time.Time{}, time.Time{}, "A")
		assert.Nil(t, frame)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid character")
	})

	t.Run("returns error when Jaeger reports an error in payload", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{
				"result": {
					"resourceSpans": []
				},
				"error": {
					"httpCode": 500,
					"message": "upstream failure"
				}
			}`))
		}))
		defer server.Close()

		settings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: []byte(`{}`),
		}

		client, err := New(server.Client(), log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "trace-1", time.Time{}, time.Time{}, "A")
		assert.Nil(t, frame)
		assert.Error(t, err)
		assert.IsType(t, status.ErrorWithSource{}, err)
		assert.Contains(t, err.Error(), "upstream failure")
	})

	t.Run("adds time range parameters when enabled", func(t *testing.T) {
		start := time.Unix(1713276200, 0).UTC()
		end := start.Add(3 * time.Second)

		var receivedQuery string
		var receivedPath string
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			receivedQuery = r.URL.RawQuery
			receivedPath = r.URL.Path
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(successTraceResponse))
		}))
		defer server.Close()

		settings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: []byte(`{"traceIdTimeParams":{"enabled":true}}`),
		}

		client, err := New(server.Client(), log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "trace-1", start, end, "RefA")
		assert.NoError(t, err)
		assert.NotNil(t, frame)

		expectedStart := start.Format(time.RFC3339Nano)
		expectedEnd := end.Format(time.RFC3339Nano)
		assert.Equal(t, "/api/v3/traces/trace-1", receivedPath)
		assert.Contains(t, receivedQuery, "start_time="+expectedStart)
		assert.Contains(t, receivedQuery, "end_time="+expectedEnd)
	})

	t.Run("returns transformed frame on success", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(successTraceResponse))
		}))
		defer server.Close()

		settings := backend.DataSourceInstanceSettings{
			URL:      server.URL,
			JSONData: []byte(`{}`),
		}

		client, err := New(server.Client(), log.NewNullLogger(), settings)
		require.NoError(t, err)

		frame, err := client.GrpcTrace(context.Background(), "abcd1234", time.Time{}, time.Time{}, "RefA")
		assert.NoError(t, err)
		require.NotNil(t, frame)
		assert.Equal(t, "RefA", frame.Name)
		assert.Equal(t, 1, frame.Fields[0].Len())
		assert.NotNil(t, frame.Meta)
		assert.Equal(t, string(data.VisTypeTrace), string(frame.Meta.PreferredVisualization))
	})
}

func TestJaegerGrpcClient_Operations(t *testing.T) {
	tests := []struct {
		name           string
		service        string
		mockResponse   string
		mockStatusCode int
		mockStatus     string
		expectedResult []string
		expectError    bool
		expectedError  error
	}{
		{
			name:    "Successful response",
			service: "test-service",
			mockResponse: `{"operations": [
								{
									"name": "operation1",
									"spanKind": "client"
								},
								{
									"name": "operation2",
									"spanKind": "client"
								}
							]}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"operation1", "operation2"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Non-200 response",
			service:        "test-service",
			mockResponse:   "",
			mockStatusCode: http.StatusInternalServerError,
			mockStatus:     "Internal Server Error",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  backend.DownstreamError(errors.New("Internal Server Error")),
		},
		{
			name:           "Invalid JSON response",
			service:        "test-service",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  status.ErrorWithSource{},
		},
		{
			name:    "Service with special characters",
			service: "test/service:1",
			mockResponse: `{"operations": [
								{
									"name": "operation1"
								}					
							]}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"operation1"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Empty service",
			service:        "",
			mockResponse:   `{"operations": []}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    false,
			expectedError:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			settings := backend.DataSourceInstanceSettings{
				URL: server.URL,
			}
			client, err := New(server.Client(), log.NewNullLogger(), settings)
			assert.NoError(t, err)

			operations, err := client.GrpcOperations(tt.service)

			if tt.expectError {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.IsType(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, operations)
			}
		})
	}
}
