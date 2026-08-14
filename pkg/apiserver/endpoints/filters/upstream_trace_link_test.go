package filters

import (
	"net/http"
	"net/http/httptest"
	"testing"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func TestWithExtractUpstreamTraceLink(t *testing.T) {
	tests := []struct {
		name         string
		headerValue  string
		expectLink   bool
		expectCalled bool
	}{
		{
			name:         "valid upstream traceparent adds span link",
			headerValue:  "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
			expectLink:   true,
			expectCalled: true,
		},
		{
			name:         "missing header is a no-op",
			headerValue:  "",
			expectLink:   false,
			expectCalled: true,
		},
		{
			name:         "invalid traceparent is a no-op",
			headerValue:  "not-a-valid-traceparent",
			expectLink:   false,
			expectCalled: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			recorder := tracetest.NewSpanRecorder()
			tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
			tracer := tp.Tracer("test")

			called := false
			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusOK)
			})

			handler := WithExtractUpstreamTraceLink(inner)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			if tc.headerValue != "" {
				req.Header.Set("Grafana-Upstream-Traceparent", tc.headerValue)
			}

			// Start a span to simulate WithTracing having already run.
			ctx, span := tracer.Start(req.Context(), "test-span")
			req = req.WithContext(ctx)

			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			span.End()

			if called != tc.expectCalled {
				t.Errorf("expected inner handler called=%v, got %v", tc.expectCalled, called)
			}

			spans := recorder.Ended()
			if len(spans) != 1 {
				t.Fatalf("expected 1 span, got %d", len(spans))
			}

			links := spans[0].Links()
			if tc.expectLink {
				if len(links) != 1 {
					t.Fatalf("expected 1 span link, got %d", len(links))
				}
				if got := links[0].SpanContext.TraceID().String(); got != "4bf92f3577b34da6a3ce929d0e0e4736" {
					t.Errorf("unexpected link trace ID: %s", got)
				}
				if got := links[0].SpanContext.SpanID().String(); got != "00f067aa0ba902b7" {
					t.Errorf("unexpected link span ID: %s", got)
				}
			} else {
				if len(links) != 0 {
					t.Errorf("expected no span links, got %d", len(links))
				}
			}
		})
	}
}
