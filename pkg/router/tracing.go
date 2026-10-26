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

// backendCall is the router's state for one call to a backend, in the
// request context under one key, so a call adds a single context value: the
// router's span, the breaker a client-scoped handler gates its own calls
// through, and why the proxy could not relay the backend's response.
type backendCall struct {
	span trace.SpanContext
	// breaker is set only for handlers that break on client calls.
	breaker *groupBreaker
	// proxyErr is recorded by proxyErrorHandler, so the breaker classifies
	// the failure itself rather than inferring it from a 502.
	proxyErr error
	// outer is the call this one is nested in, such as a plugin's own span
	// inside the router's backend span. It shares the outer call's breaker,
	// and its proxy error is the outer call's too.
	outer *backendCall
}

// setProxyErr records err on call and every call it is nested in.
func (call *backendCall) setProxyErr(err error) {
	for ; call != nil; call = call.outer {
		call.proxyErr = err
	}
}

type backendCallKey struct{}

func backendCallFrom(ctx context.Context) *backendCall {
	call, _ := ctx.Value(backendCallKey{}).(*backendCall)
	return call
}

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
	return otelhttp.NewTransport(base, otelhttp.WithPropagators(currentPropagator{}), otelhttp.WithSpanNameFormatter(func(_ string, req *http.Request) string {
		return traceHTTPMethod(req.Method)
	}))
}

// currentPropagator propagates with the global propagator of the moment, so a
// transport built once follows otel.SetTextMapPropagator. The global one may
// be a composite, which can't be compared, so it can't key a cache instead.
type currentPropagator struct{}

func (currentPropagator) Inject(ctx context.Context, carrier propagation.TextMapCarrier) {
	otel.GetTextMapPropagator().Inject(ctx, carrier)
}

func (currentPropagator) Extract(ctx context.Context, carrier propagation.TextMapCarrier) context.Context {
	return otel.GetTextMapPropagator().Extract(ctx, carrier)
}

func (currentPropagator) Fields() []string {
	return otel.GetTextMapPropagator().Fields()
}

// internalSpanKind is the router's span kind option, built once: an option
// value allocates each time it is made.
var internalSpanKind = trace.WithSpanKind(trace.SpanKindInternal)

// traceRouterRequest starts a router span for req, and returns the recorder
// to write the response through, the request carrying the span, and the
// backend call it is for. The caller defers rec.endSpan(), which ends the
// span with the outcome.
func traceRouterRequest(w http.ResponseWriter, req *http.Request, name, group string, attributes ...attribute.KeyValue) (*statusRecorder, *http.Request, *backendCall) {
	ctx := routerTraceContext(req)
	attributes = append(attributes,
		attribute.String("grafana.router.group", group),
		semconv.HTTPRequestMethodKey.String(traceHTTPMethod(req.Method)))
	ctx, span := routerTracer().Start(ctx, name, internalSpanKind, trace.WithAttributes(attributes...))
	call := &backendCall{span: span.SpanContext()}
	if outer := backendCallFrom(ctx); outer != nil {
		call.breaker, call.outer = outer.breaker, outer
	}
	ctx = context.WithValue(ctx, backendCallKey{}, call)
	rec := newStatusRecorder(w)
	rec.span, rec.spanCtx = span, ctx
	return rec, req.WithContext(ctx), call
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
