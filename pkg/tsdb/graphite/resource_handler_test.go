package graphite

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRoundTripper struct {
	respBody    []byte
	status      int
	err         error
	lastRequest *http.Request
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	m.lastRequest = req
	if m.err != nil {
		return nil, m.err
	}
	resp := &http.Response{
		StatusCode: m.status,
		Body:       io.NopCloser(bytes.NewBuffer(m.respBody)),
		Header:     make(http.Header),
	}
	return resp, nil
}

type mockInstanceManager struct {
	instance instancemgmt.Instance
	err      error
}

func (m *mockInstanceManager) Get(ctx context.Context, pluginCtx backend.PluginContext) (instancemgmt.Instance, error) {
	return m.instance, m.err
}
func (m *mockInstanceManager) Dispose(_ string) {}
func (m *mockInstanceManager) Do(ctx context.Context, pluginCtx backend.PluginContext, fn instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func TestHandleEvents(t *testing.T) {
	mockEvents := []GraphiteEventsResponse{
		{When: 1234567890, What: "event1", Tags: []string{"tag1"}, Data: "data1"},
		{When: 1234567891, What: "event2", Tags: []string{"tag2"}, Data: "data2"},
	}
	mockResp, _ := json.Marshal(mockEvents)

	tests := []struct {
		name           string
		dsInfo         *datasourceInfo
		request        GraphiteEventsRequest
		expectedStatus int
		expectError    bool
		errorContains  string
		expectedEvents []GraphiteEventsResponse
	}{
		{
			name: "Success with tags",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now", Tags: "foo"},
			expectedStatus: 200,
			expectError:    false,
			expectedEvents: mockEvents,
		},
		{
			name: "Success without tags",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now"},
			expectedStatus: 200,
			expectError:    false,
			expectedEvents: mockEvents,
		},
		{
			name: "Invalid URL",
			dsInfo: &datasourceInfo{
				Id:  1,
				URL: "ht tp://invalid url", // Invalid URL
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "unexpected error",
		},
		{
			name: "HTTP client error",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{err: errors.New("network error")}},
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to complete events request",
		},
		{
			name: "Invalid response JSON",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 400}},
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now"},
			expectedStatus: 400,
			expectError:    true,
			errorContains:  "failed to parse events response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{logger: log.NewNullLogger()}

			respBody, status, err := svc.handleEvents(context.Background(), tt.dsInfo, tt.request)

			assert.Equal(t, tt.expectedStatus, status)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, respBody)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				require.NoError(t, err)
				assert.NotNil(t, respBody)

				if tt.expectedEvents != nil {
					var result map[string][]GraphiteEventsResponse
					require.NoError(t, json.Unmarshal(respBody, &result))
					assert.Equal(t, tt.expectedEvents, result["data"])
				}
			}
		})
	}
}

func TestHandleMetricsFind(t *testing.T) {
	mockMetrics := []GraphiteMetricsFindResponse{
		{Text: "metric1", Id: "metric1.id", AllowChildren: 1, Expandable: 1, Leaf: 0},
		{Text: "metric2", Id: "metric2.id", AllowChildren: 0, Expandable: 0, Leaf: 1},
	}
	mockResp, _ := json.Marshal(mockMetrics)

	tests := []struct {
		name            string
		dsInfo          *datasourceInfo
		request         GraphiteMetricsFindRequest
		expectedStatus  int
		expectError     bool
		errorContains   string
		expectedMetrics []GraphiteMetricsFindResponse
	}{
		{
			name: "Success with query",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			request:         GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus:  200,
			expectError:     false,
			expectedMetrics: mockMetrics,
		},
		{
			name: "Success with query and time range",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			request: GraphiteMetricsFindRequest{
				Query: "app.grafana.*",
				From:  "now-1h",
				Until: "now",
			},
			expectedStatus:  200,
			expectError:     false,
			expectedMetrics: mockMetrics,
		},
		{
			name:           "Empty query",
			dsInfo:         &datasourceInfo{Id: 1, URL: "http://graphite.grafana"},
			request:        GraphiteMetricsFindRequest{Query: ""},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
			errorContains:  "query is required",
		},
		{
			name: "Invalid URL",
			dsInfo: &datasourceInfo{
				Id:  1,
				URL: "ht tp://invalid url", // Invalid URL
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "unexpected error",
		},
		{
			name: "HTTP client error",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{err: errors.New("network error")}},
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to complete metrics find request",
		},
		{
			name: "Invalid response JSON",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 400}},
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: 400,
			expectError:    true,
			errorContains:  "failed to parse metrics find response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{logger: log.NewNullLogger()}

			respBody, status, err := svc.handleMetricsFind(context.Background(), tt.dsInfo, tt.request)

			assert.Equal(t, tt.expectedStatus, status)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, respBody)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				require.NoError(t, err)
				assert.NotNil(t, respBody)

				if tt.expectedMetrics != nil {
					var result []GraphiteMetricsFindResponse
					require.NoError(t, json.Unmarshal(respBody, &result))
					assert.Equal(t, tt.expectedMetrics, result)
				}
			}
		})
	}
}

func TestHandleMetricsExpand(t *testing.T) {
	mockExpandResponse := GraphiteMetricsExpandResponse{
		Results: []string{"app.grafana.metric1", "app.grafana.metric2", "app.grafana.metric3"},
	}
	mockResp, _ := json.Marshal(mockExpandResponse)

	expectedMetrics := []GraphiteMetricsFindResponse{
		{Text: "app.grafana.metric1"},
		{Text: "app.grafana.metric2"},
		{Text: "app.grafana.metric3"},
	}

	tests := []struct {
		name            string
		dsInfo          *datasourceInfo
		request         GraphiteMetricsFindRequest
		expectedStatus  int
		expectError     bool
		errorContains   string
		expectedMetrics []GraphiteMetricsFindResponse
	}{
		{
			name: "Success with query",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			request:         GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus:  200,
			expectError:     false,
			expectedMetrics: expectedMetrics,
		},
		{
			name: "Success with query and time range",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			request: GraphiteMetricsFindRequest{
				Query: "app.grafana.*",
				From:  "now-1h",
				Until: "now",
			},
			expectedStatus:  200,
			expectError:     false,
			expectedMetrics: expectedMetrics,
		},
		{
			name:           "Empty query",
			dsInfo:         &datasourceInfo{Id: 1, URL: "http://graphite.grafana"},
			request:        GraphiteMetricsFindRequest{Query: ""},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
			errorContains:  "query is required",
		},
		{
			name: "Invalid URL",
			dsInfo: &datasourceInfo{
				Id:  1,
				URL: "ht tp://invalid url", // Invalid URL
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "unexpected error",
		},
		{
			name: "HTTP client error",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{err: errors.New("network error")}},
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to complete metrics expand request",
		},
		{
			name: "Invalid response JSON",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 400}},
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: 400,
			expectError:    true,
			errorContains:  "failed to parse metrics expand response",
		},
		{
			name: "Empty results",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte(`{"results":[]}`), status: 200}},
			},
			request:         GraphiteMetricsFindRequest{Query: "nonexistent.*"},
			expectedStatus:  200,
			expectError:     false,
			expectedMetrics: []GraphiteMetricsFindResponse{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{logger: log.NewNullLogger()}

			respBody, status, err := svc.handleMetricsExpand(context.Background(), tt.dsInfo, tt.request)

			assert.Equal(t, tt.expectedStatus, status)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, respBody)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				require.NoError(t, err)
				assert.NotNil(t, respBody)

				if tt.expectedMetrics != nil {
					var result []GraphiteMetricsFindResponse
					require.NoError(t, json.Unmarshal(respBody, &result))
					assert.Equal(t, tt.expectedMetrics, result)
				}
			}
		})
	}
}

func TestHandleFunctions(t *testing.T) {
	tests := []struct {
		name          string
		responseBody  string
		statusCode    int
		expectError   bool
		errorContains string
		expectedData  string
	}{
		{
			name:         "successful functions request",
			responseBody: `{"sum": {"description": "Sum function"}, "avg": {"description": "Average function"}}`,
			statusCode:   200,
			expectedData: `{"sum": {"description": "Sum function"}, "avg": {"description": "Average function"}}`,
		},
		{
			name:         "functions with infinity replacement",
			responseBody: `{"func": {"default": Infinity, "description": "Test function"}}`,
			statusCode:   200,
			expectedData: `{"func": {"default": 1e9999, "description": "Test function"}}`,
		},
		{
			name:         "empty functions response",
			responseBody: `{}`,
			statusCode:   200,
			expectedData: `{}`,
		},
		{
			name:          "functions request server error - now returns error due to status check",
			responseBody:  `{"error": "internal error"}`,
			statusCode:    500,
			expectError:   true,
			errorContains: "version request failed",
		},
		{
			name:          "functions request not found - now returns error due to status check",
			responseBody:  `{"error": "not found"}`,
			statusCode:    404,
			expectError:   true,
			errorContains: "version request failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockTransport := &mockRoundTripper{
				respBody: []byte(tt.responseBody),
				status:   tt.statusCode,
			}

			dsInfo := &datasourceInfo{
				HTTPClient: &http.Client{Transport: mockTransport},
				URL:        "http://graphite.example.com",
			}

			service := &Service{
				logger: log.NewNullLogger(),
			}

			result, statusCode, err := service.handleFunctions(context.Background(), dsInfo)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.statusCode, statusCode)
				assert.Equal(t, tt.expectedData, string(result))
			}

			// Verify the URL was constructed correctly
			expectedURL := "http://graphite.example.com/functions"
			assert.Equal(t, expectedURL, mockTransport.lastRequest.URL.String())
			assert.Equal(t, http.MethodGet, mockTransport.lastRequest.Method)
		})
	}
}

func TestHandleResourceReq_Success(t *testing.T) {
	mockEvents := []GraphiteEventsResponse{{When: 1234567890, What: "event1"}}
	mockResp, _ := json.Marshal(mockEvents)

	dsInfo := datasourceInfo{
		Id:         1,
		URL:        "http://graphite.grafana",
		HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
	}

	svc := &Service{
		logger: log.NewNullLogger(),
		im:     &mockInstanceManager{instance: dsInfo},
	}

	request := GraphiteEventsRequest{From: "now-1h", Until: "now"}
	requestBody, _ := json.Marshal(request)

	req := httptest.NewRequest("POST", "/events", bytes.NewBuffer(requestBody))
	req = req.WithContext(backend.WithPluginContext(context.Background(), backend.PluginContext{}))
	rr := httptest.NewRecorder()

	handler := handlePostResourceReq(svc.handleEvents, svc)
	handler(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var result map[string][]GraphiteEventsResponse
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &result))
	assert.Equal(t, mockEvents, result["data"])
}

func TestHandleResourceReq_GetDSInfoError(t *testing.T) {
	svc := &Service{
		logger: log.NewNullLogger(),
		im:     &mockInstanceManager{err: errors.New("datasource not found")},
	}

	req := httptest.NewRequest("POST", "/events", bytes.NewBufferString("{}"))
	req = req.WithContext(backend.WithPluginContext(context.Background(), backend.PluginContext{}))
	rr := httptest.NewRecorder()

	handler := handlePostResourceReq(svc.handleEvents, svc)
	handler(rr, req)

	assert.Equal(t, http.StatusInternalServerError, rr.Code)

	var errorResp map[string]string
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &errorResp))
	assert.Contains(t, errorResp["error"], "unexpected error")
}

func TestHandleResourceReq_NilHandler(t *testing.T) {
	dsInfo := datasourceInfo{Id: 1, URL: "http://graphite.grafana"}

	svc := &Service{
		logger: log.NewNullLogger(),
		im:     &mockInstanceManager{instance: dsInfo},
	}

	req := httptest.NewRequest("POST", "/events", bytes.NewBufferString("{}"))
	req = req.WithContext(backend.WithPluginContext(context.Background(), backend.PluginContext{}))
	rr := httptest.NewRecorder()

	handler := handlePostResourceReq[any](nil, svc)
	handler(rr, req)

	assert.Equal(t, http.StatusInternalServerError, rr.Code)

	var errorResp map[string]string
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &errorResp))
	assert.Equal(t, "responseFn should not be nil", errorResp["error"])
}

func TestWriteErrorResponse(t *testing.T) {
	rr := httptest.NewRecorder()
	writeErrorResponse(rr, http.StatusBadRequest, "test error message")

	assert.Equal(t, http.StatusBadRequest, rr.Code)

	var errorResp map[string]string
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &errorResp))
	assert.Equal(t, "test error message", errorResp["error"])
}

func TestDoGraphiteRequest(t *testing.T) {
	mockResponse := []GraphiteEventsResponse{
		{When: 1234567890, What: "event1", Tags: []string{"tag1"}, Data: "data1"},
	}
	mockResp, _ := json.Marshal(mockResponse)

	tests := []struct {
		name           string
		endpoint       string
		dsInfo         *datasourceInfo
		method         string
		body           io.Reader
		headers        map[string]string
		expectedStatus int
		expectError    bool
		errorContains  string
		expectedData   []GraphiteEventsResponse
	}{
		{
			name:     "Success GET request",
			endpoint: "events",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			method:         "GET",
			headers:        map[string]string{"Content-Type": "application/json"},
			expectedStatus: 200,
			expectError:    false,
			expectedData:   mockResponse,
		},
		{
			name:     "Success POST request with body",
			endpoint: "events",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			method:         "POST",
			body:           bytes.NewReader([]byte("query=test")),
			headers:        map[string]string{"Content-Type": "application/x-www-form-urlencoded"},
			expectedStatus: 200,
			expectError:    false,
			expectedData:   mockResponse,
		},
		{
			name:     "HTTP client error",
			endpoint: "events",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{err: errors.New("network error")}},
			},
			method:        "GET",
			headers:       map[string]string{},
			expectError:   true,
			errorContains: "failed to complete events request",
		},
		{
			name:     "Invalid response JSON",
			endpoint: "events",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 400}},
			},
			method:        "GET",
			headers:       map[string]string{},
			expectError:   true,
			errorContains: "failed to parse events response",
		},
		{
			name:     "Non-200 status code with valid JSON",
			endpoint: "events",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("[]"), status: 500}},
			},
			method:        "GET",
			headers:       map[string]string{},
			expectError:   true,
			errorContains: "failed to parse events response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			testURL, _ := url.Parse(fmt.Sprintf("%s/test", tt.dsInfo.URL))

			result, _, status, err := doGraphiteRequest[[]GraphiteEventsResponse](ctx, tt.endpoint, tt.dsInfo, testURL, tt.method, tt.body, tt.headers, log.NewNullLogger(), false)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				if tt.expectedStatus != 0 {
					assert.Equal(t, tt.expectedStatus, status)
				}
				if tt.expectedData != nil {
					assert.Equal(t, tt.expectedData, *result)
				}
			}
		})
	}
}

func TestParseRequestBody(t *testing.T) {
	tests := []struct {
		name          string
		requestBody   []byte
		expectError   bool
		errorContains string
		expectedData  GraphiteEventsRequest
	}{
		{
			name:         "Valid JSON request",
			requestBody:  []byte(`{"from": "now-1h", "until": "now", "tags": "app.grafana"}`),
			expectError:  false,
			expectedData: GraphiteEventsRequest{From: "now-1h", Until: "now", Tags: "app.grafana"},
		},
		{
			name:         "Empty JSON object",
			requestBody:  []byte(`{}`),
			expectError:  false,
			expectedData: GraphiteEventsRequest{},
		},
		{
			name:          "Invalid JSON",
			requestBody:   []byte(`{"invalid": json}`),
			expectError:   true,
			errorContains: "unexpected error",
		},
		{
			name:          "Empty request body",
			requestBody:   []byte(``),
			expectError:   true,
			errorContains: "unexpected error",
		},
		{
			name:          "Malformed JSON",
			requestBody:   []byte(`{"from": "now-1h", "until": }`),
			expectError:   true,
			errorContains: "unexpected error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			logger := log.NewNullLogger()

			result, err := parseRequestBody[GraphiteEventsRequest](tt.requestBody, logger)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expectedData, *result)
			}
		})
	}
}

func TestParseResponse(t *testing.T) {
	mockEvents := []GraphiteEventsResponse{
		{When: 1234567890, What: "event1", Tags: []string{"tag1"}, Data: "data1"},
		{When: 1234567891, What: "event2", Tags: []string{"tag2"}, Data: "data2"},
	}
	mockResp, _ := json.Marshal(mockEvents)

	tests := []struct {
		name          string
		response      *http.Response
		expectError   bool
		errorContains string
		expectedData  []GraphiteEventsResponse
	}{
		{
			name: "Valid JSON response",
			response: &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer(mockResp)),
				Header:     make(http.Header),
			},
			expectError:  false,
			expectedData: mockEvents,
		},
		{
			name: "Empty JSON array",
			response: &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer([]byte("[]"))),
				Header:     make(http.Header),
			},
			expectError:  false,
			expectedData: []GraphiteEventsResponse{},
		},
		{
			name: "Invalid JSON response",
			response: &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer([]byte("invalid json"))),
				Header:     make(http.Header),
			},
			expectError:   true,
			errorContains: "failed to unmarshal response",
		},
		{
			name: "Empty response body",
			response: &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer([]byte(""))),
				Header:     make(http.Header),
			},
			expectError:   true,
			errorContains: "failed to unmarshal response",
		},
		{
			name: "Malformed JSON response",
			response: &http.Response{
				StatusCode: 200,
				Body:       io.NopCloser(bytes.NewBuffer([]byte(`[{"when": 123, "what": }]`))),
				Header:     make(http.Header),
			},
			expectError:   true,
			errorContains: "failed to unmarshal response",
		},
		{
			name: "Non-200 status code",
			response: &http.Response{
				StatusCode: 400,
				Body:       io.NopCloser(bytes.NewBuffer([]byte(`random error`))),
				Header:     make(http.Header),
			},
			expectError:   true,
			errorContains: "request failed, status: 400",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, _, err := parseResponse[[]GraphiteEventsResponse](tt.response, false, log.NewNullLogger())

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, tt.expectedData, *result)
			}
		})
	}
}
