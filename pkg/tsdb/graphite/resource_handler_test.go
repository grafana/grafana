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
				URL: "ht tp://invalid url",
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to create events request",
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
			errorContains:  "events request failed",
		},
		{
			name: "Invalid response JSON",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 200}},
			},
			request:        GraphiteEventsRequest{From: "now-1h", Until: "now"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "events request failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{logger: log.NewNullLogger()}

			respBody, status, err := svc.handleEvents(context.Background(), tt.dsInfo, &tt.request)

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
				URL: "ht tp://invalid url",
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to create metrics find request",
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
			errorContains:  "metrics find request failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{logger: log.NewNullLogger()}

			respBody, status, err := svc.handleMetricsFind(context.Background(), tt.dsInfo, &tt.request)

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
				URL: "ht tp://invalid url",
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to create metrics expand request",
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
			errorContains:  "metrics expand request failed",
		},
		{
			name: "Invalid response JSON",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 200}},
			},
			request:        GraphiteMetricsFindRequest{Query: "app.grafana.*"},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "metrics expand request failed",
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

			respBody, status, err := svc.handleMetricsExpand(context.Background(), tt.dsInfo, &tt.request)

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

func TestHandleTagsAutocomplete(t *testing.T) {
	tests := []struct {
		name          string
		request       GraphiteTagsRequest
		responseBody  string
		statusCode    int
		expectError   bool
		errorContains string
		expectedData  []string
	}{
		{
			name: "successful tags autocomplete request",
			request: GraphiteTagsRequest{
				From:      "1h",
				Until:     "now",
				Limit:     10,
				TagPrefix: "app",
			},
			responseBody: `["app", "application", "app_name"]`,
			statusCode:   200,
			expectedData: []string{"app", "application", "app_name"},
		},
		{
			name:         "tags autocomplete with minimal request",
			request:      GraphiteTagsRequest{},
			responseBody: `["tag1", "tag2"]`,
			statusCode:   200,
			expectedData: []string{"tag1", "tag2"},
		},
		{
			name: "tags autocomplete with empty response",
			request: GraphiteTagsRequest{
				TagPrefix: "nonexistent",
			},
			responseBody: `[]`,
			statusCode:   200,
			expectedData: []string{},
		},
		{
			name: "tags autocomplete server error - invalid JSON causes marshal error",
			request: GraphiteTagsRequest{
				From: "invalid",
			},
			responseBody:  `invalid json response`,
			statusCode:    400,
			expectError:   true,
			errorContains: "tags autocomplete request failed",
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

			result, statusCode, err := service.handleTagsAutocomplete(context.Background(), dsInfo, &tt.request)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.statusCode, statusCode)

				var tags []string
				err = json.Unmarshal(result, &tags)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedData, tags)
			}

			if !tt.expectError {
				expectedURL := "http://graphite.example.com/tags/autoComplete/tags"
				assert.Contains(t, mockTransport.lastRequest.URL.String(), expectedURL)

				if tt.request.From != "" {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("from=%s", tt.request.From))
				}
				if tt.request.Until != "" {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("until=%s", tt.request.Until))
				}
				if tt.request.Limit != 0 {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("limit=%d", tt.request.Limit))
				}
				if tt.request.TagPrefix != "" {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("tagPrefix=%s", tt.request.TagPrefix))
				}
			}
		})
	}
}

func TestHandleTagValuesAutocomplete(t *testing.T) {
	tests := []struct {
		name          string
		request       GraphiteTagValuesRequest
		responseBody  string
		statusCode    int
		expectError   bool
		errorContains string
		expectedData  []string
	}{
		{
			name: "successful tag values autocomplete request",
			request: GraphiteTagValuesRequest{
				Expr:        []string{"app=*"},
				Tag:         "environment",
				From:        "1h",
				Until:       "now",
				Limit:       5,
				ValuePrefix: "prod",
			},
			responseBody: `["production", "prod-eu", "prod-us"]`,
			statusCode:   200,
			expectedData: []string{"production", "prod-eu", "prod-us"},
		},
		{
			name: "multiple expressions",
			request: GraphiteTagValuesRequest{
				Expr:        []string{"app=*", "region=us-*"},
				Tag:         "environment",
				From:        "1h",
				Until:       "now",
				Limit:       5,
				ValuePrefix: "prod",
			},
			responseBody: `["production", "prod-eu", "prod-us"]`,
			statusCode:   200,
			expectedData: []string{"production", "prod-eu", "prod-us"},
		},
		{
			name: "tag values autocomplete with empty response",
			request: GraphiteTagValuesRequest{
				Expr:        []string{"app=nonexistent"},
				Tag:         "environment",
				ValuePrefix: "staging",
			},
			responseBody: `[]`,
			statusCode:   200,
			expectedData: []string{},
		},
		{
			name: "tag values autocomplete server error",
			request: GraphiteTagValuesRequest{
				Expr: []string{"invalid-expr"},
				Tag:  "env",
			},
			responseBody:  `invalid json response`,
			statusCode:    400,
			expectError:   true,
			errorContains: "tag values autocomplete request failed",
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

			result, statusCode, err := service.handleTagValuesAutocomplete(context.Background(), dsInfo, &tt.request)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.statusCode, statusCode)

				var tagValues []string
				err = json.Unmarshal(result, &tagValues)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedData, tagValues)
			}

			if !tt.expectError {
				expectedURL := "http://graphite.example.com/tags/autoComplete/values"
				assert.Contains(t, mockTransport.lastRequest.URL.String(), expectedURL)

				for _, expr := range tt.request.Expr {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("expr=%s", url.QueryEscape(expr)))
				}
				assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("tag=%s", tt.request.Tag))

				if tt.request.From != "" {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("from=%s", tt.request.From))
				}
				if tt.request.Until != "" {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("until=%s", tt.request.Until))
				}
				if tt.request.Limit != 0 {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("limit=%d", tt.request.Limit))
				}
				if tt.request.ValuePrefix != "" {
					assert.Contains(t, mockTransport.lastRequest.URL.RawQuery, fmt.Sprintf("valuePrefix=%s", tt.request.ValuePrefix))
				}
			}
		})
	}
}

func TestHandleVersion(t *testing.T) {
	tests := []struct {
		name          string
		responseBody  string
		statusCode    int
		expectError   bool
		errorContains string
		expectedData  string
	}{
		{
			name:         "successful version request",
			responseBody: `"1.1.10"`,
			statusCode:   200,
			expectedData: "1.1.10",
		},
		{
			name:         "version with build info",
			responseBody: `"1.1.10-pre1"`,
			statusCode:   200,
			expectedData: "1.1.10-pre1",
		},
		{
			name:          "version request server error - invalid JSON causes parse error",
			responseBody:  `{"error": "internal error"}`,
			statusCode:    500,
			expectError:   true,
			errorContains: "version request failed",
		},
		{
			name:          "version request not found - invalid JSON causes parse error",
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

			result, statusCode, err := service.handleVersion(context.Background(), dsInfo, nil)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.statusCode, statusCode)

				var version string
				err = json.Unmarshal(result, &version)
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedData, version)
			}

			if !tt.expectError {
				expectedURL := "http://graphite.example.com/version"
				assert.Equal(t, expectedURL, mockTransport.lastRequest.URL.String())
				assert.Equal(t, http.MethodGet, mockTransport.lastRequest.Method)
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
			expectError:  false,
			expectedData: `{"sum": {"description": "Sum function"}, "avg": {"description": "Average function"}}`,
		},
		{
			name:         "functions with infinity replacement",
			responseBody: `{"func": {"default": Infinity, "description": "Test function"}}`,
			statusCode:   200,
			expectError:  false,
			expectedData: `{"func": {"default": 1e9999, "description": "Test function"}}`,
		},
		{
			name:         "empty functions response",
			responseBody: `{}`,
			statusCode:   200,
			expectError:  false,
			expectedData: `{}`,
		},
		{
			name:          "functions request server error",
			responseBody:  `{"error": "internal error"}`,
			statusCode:    500,
			expectError:   true,
			errorContains: "version request failed",
		},
		{
			name:          "functions request not found",
			responseBody:  `{"error": "not found"}`,
			statusCode:    404,
			expectError:   true,
			errorContains: "version request failed",
		},
		{
			name:          "network error",
			responseBody:  "",
			statusCode:    0,
			expectError:   true,
			errorContains: "version request failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var mockTransport *mockRoundTripper

			if tt.name == "network error" {
				mockTransport = &mockRoundTripper{
					err: errors.New("network connection failed"),
				}
			} else {
				mockTransport = &mockRoundTripper{
					respBody: []byte(tt.responseBody),
					status:   tt.statusCode,
				}
			}

			dsInfo := &datasourceInfo{
				HTTPClient: &http.Client{Transport: mockTransport},
				URL:        "http://graphite.example.com",
			}

			service := &Service{
				logger: log.NewNullLogger(),
			}

			result, statusCode, err := service.handleFunctions(context.Background(), dsInfo, nil)

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

			// Verify the request was made correctly (except for network error case)
			if tt.name != "network error" {
				require.NotNil(t, mockTransport.lastRequest)
				assert.Equal(t, "http://graphite.example.com/functions", mockTransport.lastRequest.URL.String())
				assert.Equal(t, http.MethodGet, mockTransport.lastRequest.Method)
			}
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

	handler := handleResourceReq(svc.handleEvents, svc)
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

	handler := handleResourceReq(svc.handleEvents, svc)
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

	handler := handleResourceReq[any](nil, svc)
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
			errorContains: "failed to complete request",
		},
		{
			name:     "Invalid response JSON",
			endpoint: "events",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://graphite.grafana",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 200}},
			},
			method:        "GET",
			headers:       map[string]string{},
			expectError:   true,
			errorContains: "failed to parse response",
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
			errorContains: "request failed, status: 500",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Create a service instance for the test
			svc := &Service{logger: log.NewNullLogger()}

			// Create the HTTP request using the createRequest method
			req, err := svc.createRequest(ctx, tt.dsInfo, URLParams{
				SubPath: tt.endpoint,
				Method:  tt.method,
				Body:    tt.body,
				Headers: tt.headers,
			})

			if tt.expectError {
				// For cases where we expect errors in request creation
				if err != nil {
					assert.Error(t, err)
					if tt.errorContains != "" {
						assert.Contains(t, err.Error(), tt.errorContains)
					}
					return
				}
			} else {
				assert.NoError(t, err)
			}

			result, _, status, err := doGraphiteRequest[[]GraphiteEventsResponse](ctx, tt.dsInfo, svc.logger, req, false)

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

func TestDoGraphiteRequestGenericTypes(t *testing.T) {
	// Test with GraphiteMetricsFindResponse
	mockMetrics := []GraphiteMetricsFindResponse{
		{Text: "metric1", Id: "metric1.id", AllowChildren: 1, Expandable: 1, Leaf: 0},
	}
	mockMetricsResp, _ := json.Marshal(mockMetrics)

	// Test with GraphiteMetricsExpandResponse
	mockExpand := GraphiteMetricsExpandResponse{
		Results: []string{"app.grafana.metric1", "app.grafana.metric2"},
	}
	mockExpandResp, _ := json.Marshal(mockExpand)

	tests := []struct {
		name     string
		testFunc func(t *testing.T)
	}{
		{
			name: "Success with GraphiteMetricsFindResponse type",
			testFunc: func(t *testing.T) {
				dsInfo := &datasourceInfo{
					Id:         1,
					URL:        "http://graphite.grafana",
					HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockMetricsResp, status: 200}},
				}
				ctx := context.Background()

				// Create a service instance for the test
				svc := &Service{logger: log.NewNullLogger()}

				// Create the HTTP request using the createRequest method
				req, err := svc.createRequest(ctx, dsInfo, URLParams{
					SubPath: "test",
					Method:  "GET",
				})
				assert.NoError(t, err)

				result, _, status, err := doGraphiteRequest[[]GraphiteMetricsFindResponse](ctx, dsInfo, svc.logger, req, false)

				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, 200, status)
				assert.Equal(t, mockMetrics, *result)
			},
		},
		{
			name: "Success with GraphiteMetricsExpandResponse type",
			testFunc: func(t *testing.T) {
				dsInfo := &datasourceInfo{
					Id:         1,
					URL:        "http://graphite.grafana",
					HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockExpandResp, status: 200}},
				}
				ctx := context.Background()

				// Create a service instance for the test
				svc := &Service{logger: log.NewNullLogger()}

				// Create the HTTP request using the createRequest method
				req, err := svc.createRequest(ctx, dsInfo, URLParams{
					SubPath: "test",
					Method:  "GET",
				})
				assert.NoError(t, err)

				result, _, status, err := doGraphiteRequest[GraphiteMetricsExpandResponse](ctx, dsInfo, svc.logger, req, false)

				assert.NoError(t, err)
				assert.NotNil(t, result)
				assert.Equal(t, 200, status)
				assert.Equal(t, mockExpand, *result)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, tt.testFunc)
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
