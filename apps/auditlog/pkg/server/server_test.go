package server

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	"google.golang.org/protobuf/proto"
)

func TestServer_HealthEndpoint(t *testing.T) {
	srv := New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	handler := srv.Handler()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	if rr.Body.String() != "OK" {
		t.Errorf("expected body 'OK', got '%s'", rr.Body.String())
	}
}

func TestServer_AuditLogEndpoint(t *testing.T) {
	srv := New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	handler := srv.Handler()

	// Create empty request
	logsReq := &collogspb.ExportLogsServiceRequest{}
	body, _ := proto.Marshal(logsReq)

	req := httptest.NewRequest(http.MethodPost, "/auditlog", bytes.NewReader(body))
	req.Header.Set("Content-Type", ContentTypeProtobuf)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
}

func TestServer_V1LogsEndpoint(t *testing.T) {
	srv := New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	handler := srv.Handler()

	// Create empty request
	logsReq := &collogspb.ExportLogsServiceRequest{}
	body, _ := proto.Marshal(logsReq)

	// Test the standard OTLP /v1/logs path
	req := httptest.NewRequest(http.MethodPost, "/v1/logs", bytes.NewReader(body))
	req.Header.Set("Content-Type", ContentTypeProtobuf)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d: %s", http.StatusOK, rr.Code, rr.Body.String())
	}
}

func TestServer_MethodNotAllowed(t *testing.T) {
	srv := New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	handler := srv.Handler()

	// GET on /auditlog should return 405
	req := httptest.NewRequest(http.MethodGet, "/auditlog", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	// Go 1.22+ ServeMux returns 405 for wrong methods on registered patterns
	if rr.Code != http.StatusMethodNotAllowed && rr.Code != http.StatusNotFound {
		t.Errorf("expected status 405 or 404, got %d", rr.Code)
	}
}

func TestServer_NotFound(t *testing.T) {
	srv := New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	handler := srv.Handler()

	req := httptest.NewRequest(http.MethodGet, "/nonexistent", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Errorf("expected status %d, got %d", http.StatusNotFound, rr.Code)
	}
}

func TestServer_MetricsEndpoint(t *testing.T) {
	srv := New(slog.New(slog.NewTextHandler(io.Discard, nil)))
	handler := srv.Handler()

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, rr.Code)
	}

	// Check that it returns Prometheus metrics format
	body := rr.Body.String()
	if !strings.Contains(body, "go_") && !strings.Contains(body, "auditlog_") {
		t.Error("expected Prometheus metrics in response")
	}
}
