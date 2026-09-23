package router

import (
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

func traceBackendRequest(w http.ResponseWriter, req *http.Request) (*statusRecorder, *http.Request, func()) {
	return traceRouterRequest(w, req, "router.backend")
}

func traceRouterRequest(w http.ResponseWriter, req *http.Request, name string, attributes ...attribute.KeyValue) (*statusRecorder, *http.Request, func()) {
	ctx := req.Context()
	// Embedded and loopback requests already carry their parent span in context.
	if !trace.SpanContextFromContext(ctx).IsValid() {
		ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(req.Header))
	}
	ctx, span := otel.Tracer("github.com/grafana/grafana/pkg/router").Start(ctx, name,
		trace.WithAttributes(
			attribute.String("grafana.router.group", GroupFromPath(req.URL.Path)),
			attribute.String("http.request.method", req.Method),
		))
	span.SetAttributes(attributes...)
	rec := newStatusRecorder(w)
	return rec, req.WithContext(ctx), func() {
		defer span.End()
		span.SetAttributes(attribute.Int("http.response.status_code", rec.status))
		if err := req.Context().Err(); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
		} else if rec.status >= http.StatusInternalServerError {
			span.SetStatus(codes.Error, http.StatusText(rec.status))
		}
	}
}
