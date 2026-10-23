package router

import (
	"context"
	"net/http"
	"strconv"
	"sync/atomic"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
)

type routerSpanKey struct{}

const routerTracerName = "github.com/grafana/grafana/pkg/router"

// routerTracerCache holds the router's tracer and the provider it came from.
type routerTracerCache struct {
	provider trace.TracerProvider
	tracer   trace.Tracer
}

var cachedRouterTracer atomic.Pointer[routerTracerCache]

// routerTracer returns the router's tracer without taking the provider's lock
// on every request. It follows otel.SetTracerProvider, which Grafana may call
// more than once: a tracer from an earlier provider is never reused.
func routerTracer() trace.Tracer {
	provider := otel.GetTracerProvider()
	if cached := cachedRouterTracer.Load(); cached != nil && cached.provider == provider {
		return cached.tracer
	}
	tracer := provider.Tracer(routerTracerName)
	cachedRouterTracer.Store(&routerTracerCache{provider: provider, tracer: tracer})
	return tracer
}

func routerTraceContext(req *http.Request) context.Context {
	ctx := req.Context()
	// Embedded and loopback requests already carry their parent span in context.
	if !trace.SpanContextFromContext(ctx).IsValid() {
		ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(req.Header))
	}
	return ctx
}

func newBackendTransport(base http.RoundTripper) http.RoundTripper {
	return otelhttp.NewTransport(base, otelhttp.WithSpanNameFormatter(func(_ string, req *http.Request) string {
		return traceHTTPMethod(req.Method)
	}))
}

// internalSpanKind is the router's span kind option, built once: an option
// value allocates each time it is made.
var internalSpanKind = trace.WithSpanKind(trace.SpanKindInternal)

// traceRouterRequest starts a router span for req, and returns the recorder
// to write the response through and the request carrying the span. The
// caller defers rec.endSpan(), which ends the span with the outcome.
func traceRouterRequest(w http.ResponseWriter, req *http.Request, name, group string, attributes ...attribute.KeyValue) (*statusRecorder, *http.Request) {
	ctx := routerTraceContext(req)
	attributes = append(attributes,
		attribute.String("grafana.router.group", group),
		semconv.HTTPRequestMethodKey.String(traceHTTPMethod(req.Method)))
	ctx, span := routerTracer().Start(ctx, name, internalSpanKind, trace.WithAttributes(attributes...))
	ctx = context.WithValue(ctx, routerSpanKey{}, span.SpanContext())
	rec := newStatusRecorder(w)
	rec.span, rec.spanCtx = span, ctx
	return rec, req.WithContext(ctx)
}

// endSpan ends the span traceRouterRequest started, with the response's
// outcome. It must be deferred directly, since it recovers a panic to record
// it, and then re-panics.
func (r *statusRecorder) endSpan() {
	panicked := recover()
	if panicked != nil {
		defer func() { panic(panicked) }()
	}
	span := r.span
	// End before re-panicking so the SDK does not record arbitrary panic payloads.
	defer span.End()
	err := r.spanCtx.Err()
	// A canceled or panicking handler may never have sent a response.
	if r.wroteHeader || (panicked == nil && err == nil) {
		span.SetAttributes(semconv.HTTPResponseStatusCode(r.status))
	}
	if err == context.Canceled {
		span.SetAttributes(attribute.Bool("grafana.router.canceled", true))
	} else if err != nil {
		span.SetAttributes(semconv.ErrorTypeKey.String("timeout"))
		span.SetStatus(codes.Error, "")
	} else if panicked != nil {
		span.SetAttributes(semconv.ErrorTypeKey.String("panic"))
		span.SetStatus(codes.Error, "")
	} else if r.status >= http.StatusInternalServerError {
		span.SetAttributes(semconv.ErrorTypeKey.String(strconv.Itoa(r.status)))
		span.SetStatus(codes.Error, "")
	}
}

func traceHTTPMethod(method string) string {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodPost, http.MethodPut, http.MethodDelete,
		http.MethodConnect, http.MethodOptions, http.MethodTrace, http.MethodPatch:
		return method
	default:
		return "_OTHER"
	}
}
