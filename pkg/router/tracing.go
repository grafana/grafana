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

func traceBackendRequest(w http.ResponseWriter, req *http.Request) (*statusRecorder, *http.Request, func()) {
	return traceRouterRequest(w, req, "router.backend")
}

func traceRouterRequest(w http.ResponseWriter, req *http.Request, name string, attributes ...attribute.KeyValue) (*statusRecorder, *http.Request, func()) {
	group := GroupFromPath(req.URL.Path)
	if group == "" {
		group, _, _ = parseOpenAPIGroupVersionPath(req.URL.Path)
	}
	ctx := routerTraceContext(req)
	attributes = append(attributes,
		attribute.String("grafana.router.group", group),
		attribute.String("http.request.method", traceHTTPMethod(req.Method)))
	ctx, span := otel.Tracer("github.com/grafana/grafana/pkg/router").Start(ctx, name,
		trace.WithSpanKind(trace.SpanKindInternal), trace.WithAttributes(attributes...))
	ctx = context.WithValue(ctx, routerSpanKey{}, span.SpanContext())
	rec := newStatusRecorder(w)
	return rec, req.WithContext(ctx), func() {
		defer span.End()
		span.SetAttributes(attribute.Int("http.response.status_code", rec.status))
		if err := req.Context().Err(); err == context.Canceled {
			span.SetAttributes(attribute.Bool("grafana.router.canceled", true))
		} else if err != nil {
			span.SetAttributes(attribute.String("error.type", "timeout"))
			span.SetStatus(codes.Error, "")
		} else if rec.status >= http.StatusInternalServerError {
			span.SetAttributes(attribute.String("error.type", strconv.Itoa(rec.status)))
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
