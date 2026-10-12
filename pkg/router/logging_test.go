package router

import (
	"bytes"
	"encoding/json"
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

	logRequest(req, "example.grafana.app", http.StatusUnauthorized, time.Millisecond)

	var line map[string]any
	require.NoError(t, json.Unmarshal(buf.Bytes(), &line))
	require.Equal(t, "router: request error", line["msg"])
	require.Equal(t, "4bf92f3577b34da6a3ce929d0e0e4736", line[logging.TraceIDKey])
}
