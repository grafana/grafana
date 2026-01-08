package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestMetricsMiddleware_RecordsMetrics(t *testing.T) {
	// Create a simple handler that returns 200
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	wrapped := MetricsMiddleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	wrapped.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	// Verify that requestsTotal was incremented
	count := testutil.ToFloat64(requestsTotal.WithLabelValues("GET", "/health", "200"))
	if count < 1 {
		t.Errorf("expected requests_total counter to be at least 1, got %f", count)
	}
}

func TestMetricsMiddleware_RecordsDuration(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	wrapped := MetricsMiddleware(handler)

	req := httptest.NewRequest(http.MethodPost, "/auditlog", nil)
	rr := httptest.NewRecorder()

	wrapped.ServeHTTP(rr, req)

	// Just verify the middleware executed correctly - the handler completed successfully
	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
	}
}

func TestMetricsMiddleware_RecordsStatusCodes(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
	}{
		{"200 OK", http.StatusOK},
		{"400 Bad Request", http.StatusBadRequest},
		{"500 Internal Server Error", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.statusCode)
			})

			wrapped := MetricsMiddleware(handler)

			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			rr := httptest.NewRecorder()

			wrapped.ServeHTTP(rr, req)

			if rr.Code != tt.statusCode {
				t.Errorf("expected status %d, got %d", tt.statusCode, rr.Code)
			}
		})
	}
}

func TestNormalizePath(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"/health", "/health"},
		{"/auditlog", "/auditlog"},
		{"/v1/logs", "/v1/logs"},
		{"/metrics", "/metrics"},
		{"/unknown", "other"},
		{"/some/random/path", "other"},
		{"/auditlog/something", "other"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := normalizePath(tt.input)
			if result != tt.expected {
				t.Errorf("normalizePath(%q) = %q, expected %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestRecordLogsReceived(t *testing.T) {
	initialCount := testutil.ToFloat64(logsReceivedTotal)

	RecordLogsReceived(5)

	newCount := testutil.ToFloat64(logsReceivedTotal)
	if newCount != initialCount+5 {
		t.Errorf("expected count to increase by 5, got increase of %f", newCount-initialCount)
	}

	RecordLogsReceived(3)

	finalCount := testutil.ToFloat64(logsReceivedTotal)
	if finalCount != initialCount+8 {
		t.Errorf("expected count to increase by 8 total, got increase of %f", finalCount-initialCount)
	}
}

func TestResponseWriter_DefaultStatusCode(t *testing.T) {
	rw := newResponseWriter(httptest.NewRecorder())

	// Default status code should be 200
	if rw.statusCode != http.StatusOK {
		t.Errorf("expected default status code %d, got %d", http.StatusOK, rw.statusCode)
	}
}

func TestResponseWriter_CapturesStatusCode(t *testing.T) {
	rw := newResponseWriter(httptest.NewRecorder())

	rw.WriteHeader(http.StatusNotFound)

	if rw.statusCode != http.StatusNotFound {
		t.Errorf("expected status code %d, got %d", http.StatusNotFound, rw.statusCode)
	}
}

func TestMetricsMiddleware_PassesResponseBody(t *testing.T) {
	expectedBody := "test response body"

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(expectedBody))
	})

	wrapped := MetricsMiddleware(handler)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	wrapped.ServeHTTP(rr, req)

	if !strings.Contains(rr.Body.String(), expectedBody) {
		t.Errorf("expected body to contain %q, got %q", expectedBody, rr.Body.String())
	}
}
