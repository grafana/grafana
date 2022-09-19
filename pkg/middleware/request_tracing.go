package middleware

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
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
		c.Req = addRouteNameToContext(c.Req, name)
	}
}

func addRouteNameToContext(req *http.Request, operationName string) *http.Request {
	// don't set route name if it's set
	if _, exists := routeOperationName(req); exists {
		return req
	}

	ctx := context.WithValue(req.Context(), routeOperationNameKey, operationName)
	return req.WithContext(ctx)
}

var unnamedHandlers = []struct {
	pathPattern *regexp.Regexp
	handler     string
}{
	{handler: "public-assets", pathPattern: regexp.MustCompile("^/favicon.ico")},
	{handler: "public-assets", pathPattern: regexp.MustCompile("^/public/")},
	{handler: "/metrics", pathPattern: regexp.MustCompile("^/metrics")},
	{handler: "/healthz", pathPattern: regexp.MustCompile("^/healthz")},
	{handler: "/robots.txt", pathPattern: regexp.MustCompile("^/robots.txt$")},
	// bundle all pprof endpoints under the same handler name
	{handler: "/debug/pprof-handlers", pathPattern: regexp.MustCompile("^/debug/pprof")},
}

// routeOperationName receives the route operation name from context, if set.
func routeOperationName(req *http.Request) (string, bool) {
	if val := req.Context().Value(routeOperationNameKey); val != nil {
		op, ok := val.(string)
		return op, ok
	}

	for _, hp := range unnamedHandlers {
		if hp.pathPattern.Match([]byte(req.URL.Path)) {
			return hp.handler, true
		}
	}

	return "", false
}

func RequestTracing(tracer tracing.Tracer) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if strings.HasPrefix(req.URL.Path, "/public/") || req.URL.Path == "/robots.txt" || req.URL.Path == "/favicon.ico" {
				next.ServeHTTP(w, req)
				return
			}

			rw := web.Rw(w, req)

			wireContext := otel.GetTextMapPropagator().Extract(req.Context(), propagation.HeaderCarrier(req.Header))
			ctx, span := tracer.Start(wireContext, fmt.Sprintf("HTTP %s %s", req.Method, req.URL.Path), trace.WithLinks(trace.LinkFromContext(wireContext)))

			req = req.WithContext(ctx)
			next.ServeHTTP(w, req)

			// Only call span.Finish when a route operation name have been set,
			// meaning that not set the span would not be reported.
			// TODO: do not depend on web.Context from the future
			if routeOperation, exists := routeOperationName(web.FromContext(req.Context()).Req); exists {
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
		})
	}
}
