package middleware

import (
	"fmt"
	"net/http"
	"strings"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"

	"gopkg.in/macaron.v1"
)

const routeOperationNameKey = "route.operation.name"

func ProvideRouteOperationName(handler string) macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		c.Data[routeOperationNameKey] = handler
	}
}

func RequestTracing() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		if !strings.HasPrefix(c.Req.URL.Path, "/api/") {
			c.Next()
			return
		}

		rw := res.(macaron.ResponseWriter)

		tracer := opentracing.GlobalTracer()
		wireContext, _ := tracer.Extract(opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))
		span := tracer.StartSpan(fmt.Sprintf("HTTP %s %s", req.Method, req.URL.Path), ext.RPCServerOption(wireContext))
		defer span.Finish()

		ctx := opentracing.ContextWithSpan(req.Context(), span)
		c.Req.Request = req.WithContext(ctx)

		c.Next()

		status := rw.Status()

		ext.HTTPStatusCode.Set(span, uint16(status))
		ext.HTTPUrl.Set(span, req.RequestURI)
		ext.HTTPMethod.Set(span, req.Method)
		if status >= 400 {
			ext.Error.Set(span, true)
		}

		if routeOperation, exists := c.Data[routeOperationNameKey]; exists {
			span.SetOperationName(fmt.Sprintf("HTTP %s", routeOperation.(string)))
		}
	}
}
