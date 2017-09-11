package middleware

import (
	"fmt"
	"net/http"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"

	"gopkg.in/macaron.v1"
)

func RequestTracing() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		rw := res.(macaron.ResponseWriter)

		var span opentracing.Span
		tracer := opentracing.GlobalTracer()
		wireContext, _ := tracer.Extract(opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))
		spanName := fmt.Sprintf("HTTP %s %s", req.Method, req.URL.Path)
		span = tracer.StartSpan(spanName, ext.RPCServerOption(wireContext))
		defer span.Finish()

		ctx := opentracing.ContextWithSpan(req.Context(), span)
		req = req.WithContext(ctx)

		c.Next()

		status := rw.Status()

		ext.HTTPStatusCode.Set(span, uint16(status))
		ext.HTTPUrl.Set(span, req.RequestURI)
		ext.HTTPMethod.Set(span, req.Method)
	}
}
