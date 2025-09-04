package graphite

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockRoundTripper struct {
	respBody []byte
	status   int
	err      error
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if m.err != nil {
		return nil, m.err
	}
	resp := &http.Response{
		StatusCode: m.status,
		Body:       ioutil.NopCloser(bytes.NewBuffer(m.respBody)),
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
		requestBody    []byte
		expectedStatus int
		expectError    bool
		errorContains  string
		expectedEvents []GraphiteEventsResponse
	}{
		{
			name: "Success with tags",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://example.com",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			requestBody: func() []byte {
				request := GraphiteEventsRequest{From: "now-1h", Until: "now", Tags: "foo"}
				body, _ := json.Marshal(request)
				return body
			}(),
			expectedStatus: 200,
			expectError:    false,
			expectedEvents: mockEvents,
		},
		{
			name: "Success without tags",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://example.com",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: mockResp, status: 200}},
			},
			requestBody: func() []byte {
				request := GraphiteEventsRequest{From: "now-1h", Until: "now"}
				body, _ := json.Marshal(request)
				return body
			}(),
			expectedStatus: 200,
			expectError:    false,
			expectedEvents: mockEvents,
		},
		{
			name:           "Invalid request body",
			dsInfo:         &datasourceInfo{Id: 1, URL: "http://example.com"},
			requestBody:    []byte(`{"invalid": json}`),
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "unexpected error",
		},
		{
			name: "Invalid URL",
			dsInfo: &datasourceInfo{
				Id:  1,
				URL: "ht tp://invalid url", // Invalid URL
			},
			requestBody: func() []byte {
				request := GraphiteEventsRequest{From: "now-1h", Until: "now"}
				body, _ := json.Marshal(request)
				return body
			}(),
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "unexpected error",
		},
		{
			name: "HTTP client error",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://example.com",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{err: errors.New("network error")}},
			},
			requestBody: func() []byte {
				request := GraphiteEventsRequest{From: "now-1h", Until: "now"}
				body, _ := json.Marshal(request)
				return body
			}(),
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to complete events request",
		},
		{
			name: "Invalid response JSON",
			dsInfo: &datasourceInfo{
				Id:         1,
				URL:        "http://example.com",
				HTTPClient: &http.Client{Transport: &mockRoundTripper{respBody: []byte("invalid json"), status: 200}},
			},
			requestBody: func() []byte {
				request := GraphiteEventsRequest{From: "now-1h", Until: "now"}
				body, _ := json.Marshal(request)
				return body
			}(),
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
			errorContains:  "failed to unmarshal events response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &Service{logger: log.NewNullLogger()}

			respBody, status, err := svc.handleEvents(context.Background(), tt.dsInfo, tt.requestBody)

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

func TestHandleResourceReq_Success(t *testing.T) {
	mockEvents := []GraphiteEventsResponse{{When: 1234567890, What: "event1"}}
	mockResp, _ := json.Marshal(mockEvents)

	dsInfo := datasourceInfo{
		Id:         1,
		URL:        "http://example.com",
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

	handler := svc.handleResourceReq(svc.handleEvents)
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

	handler := svc.handleResourceReq(svc.handleEvents)
	handler(rr, req)

	assert.Equal(t, http.StatusInternalServerError, rr.Code)

	var errorResp map[string]string
	require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &errorResp))
	assert.Contains(t, errorResp["error"], "unexpected error")
}

func TestHandleResourceReq_NilHandler(t *testing.T) {
	dsInfo := datasourceInfo{Id: 1, URL: "http://example.com"}

	svc := &Service{
		logger: log.NewNullLogger(),
		im:     &mockInstanceManager{instance: dsInfo},
	}

	req := httptest.NewRequest("POST", "/events", bytes.NewBufferString("{}"))
	req = req.WithContext(backend.WithPluginContext(context.Background(), backend.PluginContext{}))
	rr := httptest.NewRecorder()

	handler := svc.handleResourceReq(nil)
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
