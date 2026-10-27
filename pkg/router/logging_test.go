package router

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/stretchr/testify/require"
)

func TestLogRequestIncludesPropagatedTraceID(t *testing.T) {
	setupRouterTracing(t)
	var buf bytes.Buffer
	logger := logging.NewSLogLogger(slog.NewJSONHandler(&buf, nil))

	req := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/things", nil)
	req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	req = req.WithContext(logging.Context(req.Context(), logger))

	logRequest(req, "example.grafana.app", http.StatusConflict, time.Millisecond)

	var line map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &line))
	require.Equal(t, "router: request error", line["msg"])
	require.Equal(t, "4bf92f3577b34da6a3ce929d0e0e4736", line[logging.TraceIDKey])
}

// Successes log at Debug; when Debug is off, nothing is built or written.
func TestLogRequestHonorsTheLoggerLevel(t *testing.T) {
	for _, tc := range []struct {
		name   string
		level  slog.Level
		status int
		logged bool
	}{
		{"success, debug on", slog.LevelDebug, http.StatusOK, true},
		{"success, debug off", slog.LevelInfo, http.StatusOK, false},
		{"routine client error, debug off", slog.LevelInfo, http.StatusNotFound, false},
		{"routine client error, debug on", slog.LevelDebug, http.StatusUnauthorized, true},
		{"client error, debug off", slog.LevelInfo, http.StatusConflict, true},
		{"server error, debug off", slog.LevelInfo, http.StatusBadGateway, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			logger := logging.NewSLogLogger(slog.NewJSONHandler(&buf, &slog.HandlerOptions{Level: tc.level}))
			req := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/things", nil)
			req = req.WithContext(logging.Context(req.Context(), logger))
			logRequest(req, "example.grafana.app", tc.status, time.Millisecond)
			require.Equal(t, tc.logged, buf.Len() > 0, buf.String())
		})
	}
}

// A routine request with Debug off costs only the logger lookup, with the
// SDK's SLogLogger that Grafana installs: nothing is built for the line.
func TestLogRequestSkipsRoutineLinesCheaply(t *testing.T) {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelInfo}))
	req := httptest.NewRequest(http.MethodGet, "/apis/example.grafana.app/v1/things", nil)
	req = req.WithContext(logging.Context(req.Context(), logger))
	// logging.FromContext allocates the context-bound logger it returns.
	allocs := testing.AllocsPerRun(100, func() {
		logRequest(req, "example.grafana.app", http.StatusOK, time.Millisecond)
	})
	require.LessOrEqual(t, allocs, 1.0)
}

func TestDebugEnabled(t *testing.T) {
	ctx := t.Context()
	debug := logging.NewSLogLogger(slog.NewJSONHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelDebug}))
	info := logging.NewSLogLogger(slog.NewJSONHandler(io.Discard, &slog.HandlerOptions{Level: slog.LevelInfo}))
	require.True(t, debugEnabled(ctx, debug.WithContext(ctx)))
	require.False(t, debugEnabled(ctx, info.WithContext(ctx)))
	require.False(t, debugEnabled(ctx, &logging.NoOpLogger{}))
}
