package builder

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestIsWatchRequest(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		method string
		target string
		want   bool
	}{
		{"watch true", http.MethodGet, "/apis/foo/v1/bars?watch=true", true},
		{"watch 1", http.MethodGet, "/apis/foo/v1/bars?watch=1", true},
		{"watch false", http.MethodGet, "/apis/foo/v1/bars?watch=false", false},
		{"no watch param", http.MethodGet, "/apis/foo/v1/bars", false},
		{"list with other params", http.MethodGet, "/apis/foo/v1/bars?limit=100", false},
		{"watch on non-GET", http.MethodPost, "/apis/foo/v1/bars?watch=true", false},
		{"garbage watch value", http.MethodGet, "/apis/foo/v1/bars?watch=maybe", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			req := httptest.NewRequest(tt.method, tt.target, nil)
			assert.Equal(t, tt.want, isWatchRequest(req))
		})
	}
}

func TestWithoutWatchServerSpan(t *testing.T) {
	t.Parallel()

	newHandler := func() (http.Handler, *tracetest.SpanRecorder) {
		recorder := tracetest.NewSpanRecorder()
		tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
		inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
		return withoutWatchServerSpan(inner, tp), recorder
	}

	t.Run("does not create the server span for watch requests", func(t *testing.T) {
		t.Parallel()
		handler, recorder := newHandler()

		req := httptest.NewRequest(http.MethodGet, "/apis/foo/v1/bars?watch=true", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)

		assert.Empty(t, recorder.Ended(), "watch requests should not produce a KubernetesAPI span")
	})

	t.Run("creates the server span for non-watch requests", func(t *testing.T) {
		t.Parallel()
		handler, recorder := newHandler()

		req := httptest.NewRequest(http.MethodGet, "/apis/foo/v1/bars", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)

		spans := recorder.Ended()
		require.Len(t, spans, 1, "non-watch requests should produce a server span")
	})
}
