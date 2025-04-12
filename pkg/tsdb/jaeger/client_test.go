package jaeger

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
)

func TestJaegerClient_Services(t *testing.T) {
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
			mockResponse:   `{"data": ["service1", "service2"], "total": 2, "limit": 0, "offset": 0}`,
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
			expectedError:  errors.New("Internal Server Error"),
		},
		{
			name:           "Invalid JSON response",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  &json.SyntaxError{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, err := New(server.URL, server.Client(), log.NewNullLogger(), backend.DataSourceInstanceSettings{}, false)
			assert.NoError(t, err)

			services, err := client.Services()

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

func TestJaegerClient_Operations(t *testing.T) {
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
			name:           "Successful response",
			service:        "test-service",
			mockResponse:   `{"data": ["operation1", "operation2"], "total": 2, "limit": 0, "offset": 0}`,
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
			expectedError:  errors.New("Internal Server Error"),
		},
		{
			name:           "Invalid JSON response",
			service:        "test-service",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{},
			expectError:    true,
			expectedError:  &json.SyntaxError{},
		},
		{
			name:           "Service with special characters",
			service:        "test/service:1",
			mockResponse:   `{"data": ["operation1"], "total": 1, "limit": 0, "offset": 0}`,
			mockStatusCode: http.StatusOK,
			mockStatus:     "OK",
			expectedResult: []string{"operation1"},
			expectError:    false,
			expectedError:  nil,
		},
		{
			name:           "Empty service",
			service:        "",
			mockResponse:   `{"data": [], "total": 0, "limit": 0, "offset": 0}`,
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

			client, err := New(server.URL, server.Client(), log.NewNullLogger(), backend.DataSourceInstanceSettings{}, false)
			assert.NoError(t, err)

			operations, err := client.Operations(tt.service)

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

func TestJaegerClient_Search(t *testing.T) {
	tests := []struct {
		name           string
		query          *JaegerQuery
		mockResponse   string
		mockStatusCode int
		expectedURL    string
		expectError    bool
		expectedError  error
	}{
		{
			name: "Successful search with all parameters",
			query: &JaegerQuery{
				Service:     "test-service",
				Operation:   "test-operation",
				Tags:        "error=true",
				MinDuration: "1s",
				MaxDuration: "5s",
				Limit:       10,
			},
			mockResponse:   `{"data":[{"traceID":"test-trace-id"}]}`,
			mockStatusCode: http.StatusOK,
			expectedURL:    "/api/traces?limit=10&maxDuration=5s&minDuration=1s&operation=test-operation&service=test-service&tags=error%3Dtrue",
			expectError:    false,
			expectedError:  nil,
		},
		{
			name: "Successful search with minimal parameters",
			query: &JaegerQuery{
				Service: "test-service",
			},
			mockResponse:   `{"data":[{"traceID":"test-trace-id"}]}`,
			mockStatusCode: http.StatusOK,
			expectedURL:    "/api/traces?service=test-service",
			expectError:    false,
			expectedError:  nil,
		},
		{
			name: "Server error",
			query: &JaegerQuery{
				Service: "test-service",
			},
			mockResponse:   "",
			mockStatusCode: http.StatusInternalServerError,
			expectedURL:    "/api/traces?service=test-service",
			expectError:    true,
			expectedError:  backend.DownstreamError(fmt.Errorf("request failed: %s", http.StatusText(http.StatusInternalServerError))),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var actualURL string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				actualURL = r.URL.String()
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, err := New(server.URL, server.Client(), log.NewNullLogger(), backend.DataSourceInstanceSettings{}, false)
			assert.NoError(t, err)
			traces, err := client.Search(tt.query)

			if tt.expectError {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.IsType(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, traces)
				assert.Equal(t, tt.expectedURL, actualURL)
			}
		})
	}
}

func TestJaegerClient_Trace(t *testing.T) {
	tests := []struct {
		name               string
		traceId            string
		traceIdTimeEnabled bool
		start              int64
		end                int64
		mockResponse       string
		mockStatusCode     int
		mockStatus         string
		expectedURL        string
		expectError        bool
		expectedError      error
	}{
		{
			name:               "Successful response with time params enabled",
			traceId:            "abc123",
			traceIdTimeEnabled: true,
			start:              1000,
			end:                2000,
			mockResponse:       `{"data":[{"traceID":"abc123"}]}`,
			mockStatusCode:     http.StatusOK,
			mockStatus:         "OK",
			expectedURL:        "/api/traces/abc123?end=2000&start=1000",
			expectError:        false,
			expectedError:      nil,
		},
		{
			name:               "Successful response with time params disabled",
			traceId:            "abc123",
			traceIdTimeEnabled: false,
			start:              1000,
			end:                2000,
			mockResponse:       `{"data":[{"traceID":"abc123"}]}`,
			mockStatusCode:     http.StatusOK,
			mockStatus:         "OK",
			expectedURL:        "/api/traces/abc123",
			expectError:        false,
			expectedError:      nil,
		},
		{
			name:               "Non-200 response",
			traceId:            "abc123",
			traceIdTimeEnabled: true,
			start:              1000,
			end:                2000,
			mockResponse:       "",
			mockStatusCode:     http.StatusInternalServerError,
			mockStatus:         "Internal Server Error",
			expectedURL:        "/api/traces/abc123?end=2000&start=1000",
			expectError:        true,
			expectedError:      backend.PluginError(errors.New("Internal Server Error")),
		},
		{
			name:               "Invalid JSON response",
			traceId:            "abc123",
			traceIdTimeEnabled: true,
			start:              1000,
			end:                2000,
			mockResponse:       `{invalid json`,
			mockStatusCode:     http.StatusOK,
			mockStatus:         "OK",
			expectedURL:        "/api/traces/abc123?end=2000&start=1000",
			expectError:        true,
			expectedError:      &json.SyntaxError{},
		},
		{
			name:               "Empty trace ID",
			traceId:            "",
			traceIdTimeEnabled: true,
			start:              1000,
			end:                2000,
			mockResponse:       `{"data":[]}`,
			mockStatusCode:     http.StatusOK,
			mockStatus:         "OK",
			expectedURL:        "",
			expectError:        true,
			expectedError:      backend.DownstreamError(errors.New("traceID is empty")),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var actualURL string
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				actualURL = r.URL.String()
				w.WriteHeader(tt.mockStatusCode)
				_, _ = w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, err := New(server.URL, server.Client(), log.NewNullLogger(), backend.DataSourceInstanceSettings{}, tt.traceIdTimeEnabled)
			assert.NoError(t, err)

			trace, err := client.Trace(context.Background(), tt.traceId, tt.start, tt.end)

			if tt.expectError {
				assert.Error(t, err)
				if tt.expectedError != nil {
					assert.IsType(t, tt.expectedError, err)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, trace)
			}
			assert.Equal(t, tt.expectedURL, actualURL)
		})
	}
}
