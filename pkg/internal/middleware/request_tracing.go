package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"

	"gopkg.in/macaron.v1"
)

type contextKey struct{}

var routeOperationNameKey = contextKey{}

// ProvideRouteOperationName creates a named middleware responsible for populating
// the context with the route operation name that can be used later in the request pipeline.
// Implements routing.RegisterNamedMiddleware.
func ProvideRouteOperationName(name string) macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		ctx := context.WithValue(c.Req.Context(), routeOperationNameKey, name)
		c.Req.Request = c.Req.WithContext(ctx)
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

func RequestTracing() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		if strings.HasPrefix(c.Req.URL.Path, "/public/") ||
			c.Req.URL.Path == "robots.txt" {
			c.Next()
			return
		}

		rw := res.(macaron.ResponseWriter)

		tracer := opentracing.GlobalTracer()
		wireContext, _ := tracer.Extract(opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))
		span := tracer.StartSpan(fmt.Sprintf("HTTP %s %s", req.Method, req.URL.Path), ext.RPCServerOption(wireContext))

		ctx := opentracing.ContextWithSpan(req.Context(), span)
		c.Req.Request = req.WithContext(ctx)

		c.Next()

		// Only call span.Finish when a route operation name have been set,
		// meaning that not set the span would not be reported.
		if routeOperation, exists := RouteOperationNameFromContext(c.Req.Context()); exists {
			defer span.Finish()
			span.SetOperationName(fmt.Sprintf("HTTP %s %s", req.Method, routeOperation))
		}

		status := rw.Status()

		ext.HTTPStatusCode.Set(span, uint16(status))
		ext.HTTPUrl.Set(span, req.RequestURI)
		ext.HTTPMethod.Set(span, req.Method)
		if status >= 400 {
			ext.Error.Set(span, true)
		}
	}
}
