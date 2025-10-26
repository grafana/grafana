package middleware

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
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
	if _, exists := RouteOperationName(req); exists {
		return req
	}

	ctx := context.WithValue(req.Context(), routeOperationNameKey, operationName)
	return req.WithContext(ctx)
}

var unnamedHandlers = []struct {
	pathPattern *regexp.Regexp
	handler     string
}{
	{handler: "plugin-assets", pathPattern: regexp.MustCompile("^/public/plugins/")},
	{handler: "public-build-assets", pathPattern: regexp.MustCompile("^/public/build/")}, // All Grafana core assets should come from this path
	{handler: "public-assets", pathPattern: regexp.MustCompile("^/favicon.ico")},
	{handler: "public-assets", pathPattern: regexp.MustCompile("^/public/")}, // Fallback for other assets, this should go down to 0
	{handler: "/metrics", pathPattern: regexp.MustCompile("^/metrics")},
	{handler: "/healthz", pathPattern: regexp.MustCompile("^/healthz")},
	{handler: "/api/health", pathPattern: regexp.MustCompile("^/api/health")},
	{handler: "/robots.txt", pathPattern: regexp.MustCompile("^/robots.txt$")},
	// bundle all pprof endpoints under the same handler name
	{handler: "/debug/pprof-handlers", pathPattern: regexp.MustCompile("^/debug/pprof")},
}

// RouteOperationName receives the route operation name from context, if set.
func RouteOperationName(req *http.Request) (string, bool) {
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

// Paths that don't need tracing spans applied to them because of the
// little value that would provide us
func SkipTracingPaths(req *http.Request) bool {
	return strings.HasPrefix(req.URL.Path, "/public/") ||
		req.URL.Path == "/robots.txt" ||
		req.URL.Path == "/favicon.ico" ||
		req.URL.Path == "/api/health"
}

func TraceAllPaths(req *http.Request) bool {
	return true
}

func RequestTracing(tracer trace.Tracer, shouldTrace func(*http.Request) bool) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			if !shouldTrace(req) {
				next.ServeHTTP(w, req)
				return
			}

			// Extract the parent span context from the incoming request.
			ctx := otel.GetTextMapPropagator().Extract(req.Context(), propagation.HeaderCarrier(req.Header))

			// generic span name for requests where there's no route operation name
			spanName := fmt.Sprintf("HTTP %s <unknown>", req.Method)

			ctx, span := tracer.Start(ctx, spanName, trace.WithAttributes(
				semconv.HTTPURLKey.String(req.RequestURI),
				semconv.HTTPMethodKey.String(req.Method),
			), trace.WithSpanKind(trace.SpanKindServer))
			defer span.End()

			// inject local root span context into the response via server-timing header
			// we're doing it this early so that we can capture the root span context
			// which is not available later-on.
			serverTimingValue := tracing.ServerTimingForSpan(span)
			if serverTimingValue != "" {
				w.Header().Set("server-timing", fmt.Sprintf("traceparent;desc=\"%s\"", serverTimingValue))
			}

			req = req.WithContext(ctx)

			// Ensure the response writer's status can be captured.
			rw := web.Rw(w, req)

			next.ServeHTTP(rw, req)

			// Reset the span name after the request has been processed, as
			// the route operation may have been injected by middleware.
			// TODO: do not depend on web.Context from the future
			if routeOperation, exists := RouteOperationName(web.FromContext(req.Context()).Req); exists {
				span.SetName(fmt.Sprintf("HTTP %s %s", req.Method, routeOperation))
			}

			status := rw.Status()

			span.SetAttributes(semconv.HTTPStatusCode(status))
			if status >= 400 {
				span.SetStatus(codes.Error, fmt.Sprintf("error with HTTP status code %s", strconv.Itoa(status)))
			}
		})
	}
}
