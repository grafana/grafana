package middleware

import (
	"fmt"
	"net/http"

	opentracing "github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"

	"gopkg.in/macaron.v1"
)

func RequestTracing(handler string) macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		rw := res.(macaron.ResponseWriter)

		tracer := opentracing.GlobalTracer()
		wireContext, _ := tracer.Extract(opentracing.HTTPHeaders, opentracing.HTTPHeadersCarrier(req.Header))
		span := tracer.StartSpan(fmt.Sprintf("HTTP %s", handler), ext.RPCServerOption(wireContext))
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
	}
}
