package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/web"
)

type contextKey struct{}

var routeOperationNameKey = contextKey{}

// ProvideRouteOperationName creates a named middleware responsible for populating
// the context with the route operation name that can be used later in the request pipeline.
// Implements routing.RegisterNamedMiddleware.
func ProvideRouteOperationName(name string) web.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *web.Context) {
		ctx := context.WithValue(c.Req.Context(), routeOperationNameKey, name)
		c.Req = c.Req.WithContext(ctx)
	}
}

// RouteOperationNameFromContext receives the route operation name from context, if set.
func RouteOperationNameFromContext(ctx context.Context) (string, bool) {
	if val := ctx.Value(routeOperationNameKey); val != nil {
		op, ok := val.(string)
		return op, ok
	}

	return "", false
}

func RequestTracing(tracer tracing.Tracer) web.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *web.Context) {
		if strings.HasPrefix(c.Req.URL.Path, "/public/") ||
			c.Req.URL.Path == "robots.txt" {
			c.Next()
			return
		}

		rw := res.(web.ResponseWriter)

		wireContext := otel.GetTextMapPropagator().Extract(req.Context(), propagation.HeaderCarrier(req.Header))
		ctx, span := tracer.Start(req.Context(), fmt.Sprintf("HTTP %s %s", req.Method, req.URL.Path), trace.WithLinks(trace.LinkFromContext(wireContext)))

		c.Req = req.WithContext(ctx)
		c.Map(c.Req)

		c.Next()

		// Only call span.Finish when a route operation name have been set,
		// meaning that not set the span would not be reported.
		if routeOperation, exists := RouteOperationNameFromContext(c.Req.Context()); exists {
			defer span.End()
			span.SetName(fmt.Sprintf("HTTP %s %s", req.Method, routeOperation))
		}

		status := rw.Status()

		span.SetAttributes("http.status_code", status, attribute.Int("http.status_code", status))
		span.SetAttributes("http.url", req.RequestURI, attribute.String("http.url", req.RequestURI))
		span.SetAttributes("http.method", req.Method, attribute.String("http.method", req.Method))
		if status >= 400 {
			span.SetStatus(codes.Error, fmt.Sprintf("error with HTTP status code %s", strconv.Itoa(status)))
		}
	}
}
