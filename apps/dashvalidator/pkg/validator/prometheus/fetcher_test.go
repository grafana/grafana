package prometheus

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/apps/dashvalidator/pkg/validator"
	"github.com/stretchr/testify/require"
)

// ============================================================================
// Category 1: Happy Path - Successful Metric Fetching
// ============================================================================

func TestFetchMetrics_Success_ReturnsMetrics(t *testing.T) {
	// Setup test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "/api/v1/label/__name__/values", r.URL.Path)

		// Return valid response
		resp := prometheusResponse{
			Status: "success",
			Data:   []string{"up", "http_requests_total", "process_cpu_seconds_total"},
		}
		w.WriteHeader(http.StatusOK)
		err := json.NewEncoder(w).Encode(resp)
		require.NoError(t, err)
	}))
	defer server.Close()

	// Execute
	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

	// Verify
	require.NoError(t, err)
	require.Len(t, metrics, 3)
	require.ElementsMatch(t, []string{"up", "http_requests_total", "process_cpu_seconds_total"}, metrics)
}

func TestFetchMetrics_Success_URLWithPath(t *testing.T) {
	// Test that URLs with existing paths (e.g., /api/prom) work correctly
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify the path is correctly joined
		require.Equal(t, "/api/prom/api/v1/label/__name__/values", r.URL.Path)

		resp := prometheusResponse{
			Status: "success",
			Data:   []string{"metric_a", "metric_b"},
		}
		w.WriteHeader(http.StatusOK)
		err := json.NewEncoder(w).Encode(resp)
		require.NoError(t, err)
	}))
	defer server.Close()

	// Execute with path suffix
	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL+"/api/prom", server.Client())

	// Verify
	require.NoError(t, err)
	require.Len(t, metrics, 2)
	require.ElementsMatch(t, []string{"metric_a", "metric_b"}, metrics)
}

// ============================================================================
// Category 2: URL Parsing Errors
// ============================================================================

func TestFetchMetrics_InvalidURL_ReturnsConfigError(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		expectedMsg string
	}{
		{
			name:        "malformed URL with control character",
			url:         "http://example.com/\x00path",
			expectedMsg: "invalid datasource URL",
		},
		{
			name:        "invalid URL scheme",
			url:         "://missing-scheme",
			expectedMsg: "invalid datasource URL",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fetcher := NewFetcher()
			metrics, err := fetcher.FetchMetrics(context.Background(), tt.url, &http.Client{})

			// Verify error
			require.Error(t, err)
			require.Nil(t, metrics)
			require.True(t, validator.IsValidationError(err))

			validationErr := validator.GetValidationError(err)
			require.Equal(t, validator.ErrCodeDatasourceConfig, validationErr.Code)
			require.Equal(t, http.StatusBadRequest, validator.GetHTTPStatusCode(err))
			require.Contains(t, validationErr.Message, tt.expectedMsg)
		})
	}
}

func TestFetchMetrics_EmptyURL_ReturnsNetworkError(t *testing.T) {
	// Note: An empty URL is technically parseable by Go's url.Parse
	// but results in a network error when trying to make the request
	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), "", &http.Client{})

	// Verify error - empty URL fails at network level, not URL parsing
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	require.Equal(t, validator.ErrCodeDatasourceUnreachable, validationErr.Code)
}

// ============================================================================
// Category 3: Network and Connection Errors
// ============================================================================

func TestFetchMetrics_ConnectionRefused_ReturnsUnreachableError(t *testing.T) {
	// Use a port that's definitely not listening
	fetcher := NewFetcher()
	client := &http.Client{Timeout: 100 * time.Millisecond}

	metrics, err := fetcher.FetchMetrics(context.Background(), "http://127.0.0.1:1", client)

	// Verify error
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	require.Equal(t, validator.ErrCodeDatasourceUnreachable, validationErr.Code)
	require.Equal(t, http.StatusServiceUnavailable, validator.GetHTTPStatusCode(err))
}

func TestFetchMetrics_ContextCancelled_ReturnsError(t *testing.T) {
	// Create a server that delays response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Wait longer than we'll allow
		time.Sleep(200 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create context and cancel immediately
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(ctx, server.URL, server.Client())

	// Verify error - context cancellation returns unreachable error
	require.Error(t, err)
	require.Nil(t, metrics)
}

// ============================================================================
// Category 4: Timeout Errors
// ============================================================================

func TestFetchMetrics_HTTPClientTimeout_ReturnsTimeoutError(t *testing.T) {
	// This test verifies that the HTTP client-level timeout works correctly.
	// Unlike context deadline, this tests the http.Client.Timeout field.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Wait longer than the client timeout
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create HTTP client with a very short timeout
	client := &http.Client{
		Timeout: 10 * time.Millisecond,
	}

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, client)

	// Verify timeout error is returned
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	// HTTP client timeout returns a timeout error which is detected as ErrCodeAPITimeout
	require.Equal(t, validator.ErrCodeAPITimeout, validationErr.Code)
	require.Equal(t, http.StatusGatewayTimeout, validator.GetHTTPStatusCode(err))
}

func TestFetchMetrics_DeadlineExceeded_ReturnsTimeoutError(t *testing.T) {
	// Create a server that delays response longer than the context deadline
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Wait longer than the deadline
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	// Create context with very short deadline
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(ctx, server.URL, server.Client())

	// Verify error
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	require.Equal(t, validator.ErrCodeAPITimeout, validationErr.Code)
	require.Equal(t, http.StatusGatewayTimeout, validator.GetHTTPStatusCode(err))
	require.Contains(t, validationErr.Message, "timed out")
}

// ============================================================================
// Category 5: HTTP Status Code Handling
// ============================================================================

func TestFetchMetrics_HTTPStatusCodes_ReturnsExpectedError(t *testing.T) {
	tests := []struct {
		name               string
		statusCode         int
		expectedErrorCode  validator.ErrorCode
		expectedHTTPStatus int
		expectedMsgPart    string
	}{
		{
			name:               "401 Unauthorized",
			statusCode:         http.StatusUnauthorized,
			expectedErrorCode:  validator.ErrCodeDatasourceAuth,
			expectedHTTPStatus: http.StatusUnauthorized,
			expectedMsgPart:    "authentication failed",
		},
		{
			name:               "403 Forbidden",
			statusCode:         http.StatusForbidden,
			expectedErrorCode:  validator.ErrCodeDatasourceAuth,
			expectedHTTPStatus: http.StatusUnauthorized,
			expectedMsgPart:    "authentication failed",
		},
		{
			name:               "404 Not Found",
			statusCode:         http.StatusNotFound,
			expectedErrorCode:  validator.ErrCodeAPIUnavailable,
			expectedHTTPStatus: http.StatusBadGateway,
			expectedMsgPart:    "status 404",
		},
		{
			name:               "429 Rate Limit",
			statusCode:         http.StatusTooManyRequests,
			expectedErrorCode:  validator.ErrCodeAPIRateLimit,
			expectedHTTPStatus: http.StatusTooManyRequests,
			expectedMsgPart:    "rate limit",
		},
		{
			name:               "500 Internal Server Error",
			statusCode:         http.StatusInternalServerError,
			expectedErrorCode:  validator.ErrCodeAPIUnavailable,
			expectedHTTPStatus: http.StatusBadGateway,
			expectedMsgPart:    "status 500",
		},
		{
			name:               "502 Bad Gateway",
			statusCode:         http.StatusBadGateway,
			expectedErrorCode:  validator.ErrCodeAPIUnavailable,
			expectedHTTPStatus: http.StatusBadGateway,
			expectedMsgPart:    "status 502",
		},
		{
			name:               "503 Service Unavailable",
			statusCode:         http.StatusServiceUnavailable,
			expectedErrorCode:  validator.ErrCodeAPIUnavailable,
			expectedHTTPStatus: http.StatusBadGateway,
			expectedMsgPart:    "status 503",
		},
		{
			name:               "504 Gateway Timeout",
			statusCode:         http.StatusGatewayTimeout,
			expectedErrorCode:  validator.ErrCodeAPIUnavailable,
			expectedHTTPStatus: http.StatusBadGateway,
			expectedMsgPart:    "status 504",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte("error response body"))
			}))
			defer server.Close()

			fetcher := NewFetcher()
			metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

			// Verify error
			require.Error(t, err)
			require.Nil(t, metrics)
			require.True(t, validator.IsValidationError(err))

			validationErr := validator.GetValidationError(err)
			require.Equal(t, tt.expectedErrorCode, validationErr.Code)
			require.Equal(t, tt.expectedHTTPStatus, validator.GetHTTPStatusCode(err))
			require.Contains(t, validationErr.Message, tt.expectedMsgPart)
		})
	}
}

// ============================================================================
// Category 6: JSON Response Validation
// ============================================================================

func TestFetchMetrics_InvalidJSON_ReturnsParsingError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("not valid json"))
	}))
	defer server.Close()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

	// Verify error
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	require.Equal(t, validator.ErrCodeAPIInvalidResponse, validationErr.Code)
	require.Equal(t, http.StatusBadGateway, validator.GetHTTPStatusCode(err))
	require.Contains(t, validationErr.Message, "not valid JSON")
}

func TestFetchMetrics_StatusError_ReturnsInvalidResponseError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := prometheusResponse{
			Status: "error",
			Error:  "execution error: something went wrong",
		}
		w.WriteHeader(http.StatusOK)
		err := json.NewEncoder(w).Encode(resp)
		require.NoError(t, err)
	}))
	defer server.Close()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

	// Verify error
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	require.Equal(t, validator.ErrCodeAPIInvalidResponse, validationErr.Code)
	require.Equal(t, http.StatusBadGateway, validator.GetHTTPStatusCode(err))
	require.Contains(t, validationErr.Message, "error status")
	require.Contains(t, validationErr.Message, "execution error: something went wrong")
	require.Equal(t, "execution error: something went wrong", validationErr.Details["prometheusError"])
}

func TestFetchMetrics_MissingDataField_ReturnsInvalidResponseError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return JSON with success status but nil data
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"success"}`))
	}))
	defer server.Close()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

	// Verify error
	require.Error(t, err)
	require.Nil(t, metrics)
	require.True(t, validator.IsValidationError(err))

	validationErr := validator.GetValidationError(err)
	require.Equal(t, validator.ErrCodeAPIInvalidResponse, validationErr.Code)
	require.Equal(t, http.StatusBadGateway, validator.GetHTTPStatusCode(err))
	require.Contains(t, validationErr.Message, "missing 'data' field")
}

func TestFetchMetrics_ExtraFields_Succeeds(t *testing.T) {
	// Test forward compatibility - extra fields should be ignored
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return response with extra fields
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"status": "success",
			"data": ["metric_a", "metric_b"],
			"warnings": ["some warning"],
			"extraField": "should be ignored",
			"version": "2.0"
		}`))
	}))
	defer server.Close()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

	// Verify success despite extra fields
	require.NoError(t, err)
	require.Len(t, metrics, 2)
	require.ElementsMatch(t, []string{"metric_a", "metric_b"}, metrics)
}

func TestFetchMetrics_EmptyDataArray_Succeeds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := prometheusResponse{
			Status: "success",
			Data:   []string{}, // Empty but present
		}
		w.WriteHeader(http.StatusOK)
		err := json.NewEncoder(w).Encode(resp)
		require.NoError(t, err)
	}))
	defer server.Close()

	fetcher := NewFetcher()
	metrics, err := fetcher.FetchMetrics(context.Background(), server.URL, server.Client())

	// Verify success with empty data
	require.NoError(t, err)
	require.NotNil(t, metrics)
	require.Empty(t, metrics)
}
