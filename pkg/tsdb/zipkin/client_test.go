package zipkin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/openzipkin/zipkin-go/model"
	"github.com/stretchr/testify/assert"
)

func TestZipkinClient_Services(t *testing.T) {
	tests := []struct {
		name           string
		mockResponse   string
		mockStatusCode int
		expectedResult []string
		expectError    bool
	}{
		{
			name:           "Successful response",
			mockResponse:   `["service1", "service2"]`,
			mockStatusCode: http.StatusOK,
			expectedResult: []string{"service1", "service2"},
			expectError:    false,
		},
		{
			name:           "Non-200 response",
			mockResponse:   "",
			mockStatusCode: http.StatusInternalServerError,
			expectedResult: []string{},
			expectError:    true,
		},
		{
			name:           "Invalid JSON response",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			expectedResult: []string{},
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/api/v2/services", r.URL.Path)
				w.WriteHeader(tt.mockStatusCode)
				w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, _ := New(server.URL, server.Client(), log.New())
			services, err := client.Services()

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.expectedResult, services)
		})
	}
}

func TestZipkinClient_Spans(t *testing.T) {
	tests := []struct {
		name           string
		serviceName    string
		mockResponse   string
		mockStatusCode int
		expectedResult []string
		expectError    bool
	}{
		{
			name:           "Successful response",
			serviceName:    "service1",
			mockResponse:   `["span1", "span2"]`,
			mockStatusCode: http.StatusOK,
			expectedResult: []string{"span1", "span2"},
			expectError:    false,
		},
		{
			name:           "Non-200 response",
			serviceName:    "service1",
			mockResponse:   "",
			mockStatusCode: http.StatusNotFound,
			expectedResult: []string{},
			expectError:    true,
		},
		{
			name:           "Invalid JSON response",
			serviceName:    "service1",
			mockResponse:   `{invalid json`,
			mockStatusCode: http.StatusOK,
			expectedResult: []string{},
			expectError:    true,
		},
		{
			name:           "Empty serviceName",
			serviceName:    "",
			mockResponse:   "",
			mockStatusCode: http.StatusOK,
			expectedResult: []string{},
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/api/v2/spans", r.URL.Path)
				w.WriteHeader(tt.mockStatusCode)
				w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client, _ := New(server.URL, server.Client(), log.New())
			spans, err := client.Spans(tt.serviceName)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.expectedResult, spans)
		})
	}
}

func TestZipkinClient_Traces(t *testing.T) {
	tests := []struct {
		name           string
		serviceName    string
		spanName       string
		mockResponse   interface{}
		mockStatusCode int
		expectedResult [][]model.SpanModel
		expectError    bool
		expectedError  string
	}{
		{
			name:           "Successful response",
			serviceName:    "service1",
			spanName:       "span1",
			mockResponse:   [][]model.SpanModel{{{SpanContext: model.SpanContext{TraceID: model.TraceID{Low: 1234}, ID: 1}, Name: "operation1", Tags: map[string]string{"key1": "value1"}}}},
			mockStatusCode: http.StatusOK,
			expectedResult: [][]model.SpanModel{{{SpanContext: model.SpanContext{TraceID: model.TraceID{Low: 1234}, ID: 1}, Name: "operation1", Tags: map[string]string{"key1": "value1"}}}},
			expectError:    false,
			expectedError:  "",
		},
		{
			name:           "Non-200 response",
			serviceName:    "service1",
			spanName:       "span1",
			mockResponse:   nil,
			mockStatusCode: http.StatusForbidden,
			expectedResult: [][]model.SpanModel{},
			expectError:    true,
			expectedError:  "EOF",
		},
		{
			name:           "Empty serviceName",
			serviceName:    "",
			spanName:       "span1",
			mockResponse:   nil,
			mockStatusCode: http.StatusOK,
			expectedResult: [][]model.SpanModel{},
			expectError:    true,
			expectedError:  "invalid/empty serviceName",
		},
		{
			name:           "Empty spanName",
			serviceName:    "service1",
			spanName:       "",
			mockResponse:   nil,
			mockStatusCode: http.StatusOK,
			expectedResult: [][]model.SpanModel{},
			expectError:    true,
			expectedError:  "invalid/empty spanName",
		},
		{
			name:           "Valid response with empty trace list",
			serviceName:    "service1",
			spanName:       "span1",
			mockResponse:   [][]model.SpanModel{},
			mockStatusCode: http.StatusOK,
			expectedResult: [][]model.SpanModel{},
			expectError:    false,
			expectedError:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var response []byte
			if mockData, ok := tt.mockResponse.([][]model.SpanModel); ok {
				response, _ = json.Marshal(mockData)
			} else if str, ok := tt.mockResponse.(string); ok {
				response = []byte(str)
			}

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/api/v2/traces", r.URL.Path)
				w.WriteHeader(tt.mockStatusCode)
				w.Write(response)
			}))
			defer server.Close()

			client, _ := New(server.URL, server.Client(), log.New())
			traces, err := client.Traces(tt.serviceName, tt.spanName)

			if tt.expectError {
				assert.Error(t, err)
				assert.Equal(t, err.Error(), tt.expectedError)
			} else {
				assert.NoError(t, err)
			}

			assert.Equal(t, tt.expectedResult, traces)
		})
	}
}

func TestZipkinClient_Trace(t *testing.T) {
	tests := []struct {
		name           string
		traceID        string
		mockResponse   string
		mockStatusCode int
		expectedResult []model.SpanModel
		expectError    bool
		expectedError  string
	}{
		{
			name:           "Successful response",
			traceID:        "trace-id",
			mockResponse:   `[{"traceId":"00000000000004d2","id":"0000000000000001","name":"operation1","tags":{"key1":"value1"}}]`,
			mockStatusCode: http.StatusOK,
			expectedResult: []model.SpanModel{
				{
					SpanContext: model.SpanContext{
						TraceID: model.TraceID{Low: 1234},
						ID:      model.ID(1),
					},
					Name: "operation1",
					Tags: map[string]string{"key1": "value1"},
				},
			},
			expectError: false,
		},
		{
			name:           "Invalid traceID",
			traceID:        "",
			mockResponse:   "",
			mockStatusCode: http.StatusOK,
			expectedResult: []model.SpanModel{},
			expectError:    true,
			expectedError:  "invalid/empty traceId",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var client ZipkinClient
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "/api/v2/trace/"+tt.traceID, r.URL.Path)
				w.WriteHeader(tt.mockStatusCode)
				w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()
			client, _ = New(server.URL, server.Client(), log.New())

			trace, err := client.Trace(tt.traceID)

			if tt.expectError {
				assert.Error(t, err)
				assert.Empty(t, trace)
				assert.Equal(t, tt.expectedError, err.Error())
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, trace)
			}
		})
	}
}
