package router

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/logging"
)

func TestLogRequestIncludesPropagatedTraceID(t *testing.T) {
	setupRouterTracing(t)
	var buf bytes.Buffer
	logger := logging.NewSLogLogger(slog.NewJSONHandler(&buf, nil))

	req := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/things", nil)
	req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	req = req.WithContext(logging.Context(req.Context(), logger))

	logRequest(req, "example.grafana.app", http.StatusBadRequest, time.Millisecond)

	var line map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &line))
	require.Equal(t, "router: request error", line["msg"])
	require.Equal(t, "4bf92f3577b34da6a3ce929d0e0e4736", line[logging.TraceIDKey])
}

func TestReconcileWarnsOnceForALastingProblem(t *testing.T) {
	var buf bytes.Buffer
	ctx := logging.Context(t.Context(), logging.NewSLogLogger(slog.NewJSONHandler(&buf, nil)))
	loader := &swapLoader{}
	loader.set(
		&fakeBackend{group: metav1.APIGroup{Name: "dashboard.grafana.app"}, key: "1"},
		&fakeBackend{group: metav1.APIGroup{Name: "dup.ext.grafana.app"}, key: "1"},
		&fakeBackend{group: metav1.APIGroup{Name: "dup.ext.grafana.app"}, key: "2"},
	)
	router := NewGrafanaRouter(loader)
	router.acceptGroup = isPluginAPIGroup

	for range 3 {
		require.NoError(t, router.reconcile(ctx))
	}
	require.Equal(t, 1, strings.Count(buf.String(), "group not allowed in this mode"))
	require.Equal(t, 1, strings.Count(buf.String(), "duplicate group in route set"))

	// A change in the affected groups is logged again; their absence is not.
	loader.set(&fakeBackend{group: metav1.APIGroup{Name: "folder.grafana.app"}, key: "1"})
	require.NoError(t, router.reconcile(ctx))
	require.Equal(t, 2, strings.Count(buf.String(), "group not allowed in this mode"))
	require.Contains(t, buf.String(), `"group":"folder.grafana.app"`)
	require.Equal(t, 1, strings.Count(buf.String(), "duplicate group in route set"))
}

func TestLogRequestLevels(t *testing.T) {
	for status, level := range map[int]string{
		http.StatusOK:                  "DEBUG",
		http.StatusUnauthorized:        "DEBUG",
		http.StatusForbidden:           "DEBUG",
		http.StatusNotFound:            "DEBUG",
		http.StatusBadRequest:          "WARN",
		http.StatusConflict:            "WARN",
		http.StatusInternalServerError: "ERROR",
		http.StatusBadGateway:          "ERROR",
	} {
		var buf bytes.Buffer
		logger := logging.NewSLogLogger(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug}))
		req := httptest.NewRequest(http.MethodGet, "/apis/g", nil)
		logRequest(req.WithContext(logging.Context(req.Context(), logger)), "g", status, time.Millisecond)
		var line map[string]any
		require.NoError(t, json.Unmarshal(buf.Bytes(), &line), "status %d", status)
		require.Equal(t, level, line["level"], "status %d", status)
	}
}
