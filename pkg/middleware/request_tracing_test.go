package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/grafana/grafana/pkg/web"
)

// Under serve_from_sub_path, macaron trims the configured prefix from URL.Path
// before routing but leaves the original RequestURI untouched. The span must
// therefore expose url.path as the routed path so the tracing endpoint filter
// can match /metrics rather than /grafana/metrics.
func TestRequestTracing_RecordsRoutedPath(t *testing.T) {
	recorder := tracetest.NewSpanRecorder()
	tracer := tracesdk.NewTracerProvider(tracesdk.WithSpanProcessor(recorder)).Tracer("test")

	m := web.New()
	m.SetURLPrefix("/grafana")
	m.UseMiddleware(RequestTracing(tracer, ShouldTraceAllPaths))
	m.Get("/metrics", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	m.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/grafana/metrics?foo=bar", nil))
	require.Equal(t, http.StatusOK, rec.Code)

	spans := recorder.Ended()
	require.Len(t, spans, 1)

	attrs := map[attribute.Key]string{}
	for _, a := range spans[0].Attributes() {
		attrs[a.Key] = a.Value.AsString()
	}

	// http.url keeps the full, prefixed RequestURI; url.path is the routed path
	// the endpoint filter matches on.
	assert.Equal(t, "/grafana/metrics?foo=bar", attrs["http.url"])
	assert.Equal(t, "/metrics", attrs["url.path"])
}
