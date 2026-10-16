package router

import (
	"context"
	"net/http"
	"strconv"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.43.0"
	"go.opentelemetry.io/otel/trace"
)

type routerSpanKey struct{}

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

func traceRouterRequest(w http.ResponseWriter, req *http.Request, name, group string, attributes ...attribute.KeyValue) (*statusRecorder, *http.Request, func()) {
	ctx := routerTraceContext(req)
	attributes = append(attributes,
		attribute.String("grafana.router.group", group),
		semconv.HTTPRequestMethodKey.String(traceHTTPMethod(req.Method)))
	ctx, span := otel.Tracer("github.com/grafana/grafana/pkg/router").Start(ctx, name,
		trace.WithSpanKind(trace.SpanKindInternal), trace.WithAttributes(attributes...))
	ctx = context.WithValue(ctx, routerSpanKey{}, span.SpanContext())
	rec := newStatusRecorder(w)
	return rec, req.WithContext(ctx), func() {
		panicked := recover()
		if panicked != nil {
			defer func() { panic(panicked) }()
		}
		// End before re-panicking so the SDK does not record arbitrary panic payloads.
		defer span.End()
		// A canceled or panicking handler may never have sent a response.
		if rec.wroteHeader || (panicked == nil && req.Context().Err() == nil) {
			span.SetAttributes(semconv.HTTPResponseStatusCode(rec.status))
		}
		if err := req.Context().Err(); err == context.Canceled {
			span.SetAttributes(attribute.Bool("grafana.router.canceled", true))
		} else if err != nil {
			span.SetAttributes(semconv.ErrorTypeKey.String("timeout"))
			span.SetStatus(codes.Error, "")
		} else if panicked != nil {
			span.SetAttributes(semconv.ErrorTypeKey.String("panic"))
			span.SetStatus(codes.Error, "")
		} else if rec.status >= http.StatusInternalServerError {
			span.SetAttributes(semconv.ErrorTypeKey.String(strconv.Itoa(rec.status)))
			span.SetStatus(codes.Error, "")
		}
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
