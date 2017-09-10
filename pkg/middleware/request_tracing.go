package middleware

import (
	"net/http"
	"time"

	opentracing "github.com/opentracing/opentracing-go"
	tlog "github.com/opentracing/opentracing-go/log"

	"gopkg.in/macaron.v1"
)

func RequestTracing() macaron.Handler {
	return func(res http.ResponseWriter, req *http.Request, c *macaron.Context) {
		rw := res.(macaron.ResponseWriter)

		var span opentracing.Span
		opName := req.URL.Path
		carrier := opentracing.HTTPHeadersCarrier(req.Header)

		wireContext, err := opentracing.GlobalTracer().Extract(
			opentracing.HTTPHeaders, carrier)
		if err != nil {
			span = opentracing.StartSpan(opName)
		} else {
			span = opentracing.StartSpan(opName, opentracing.ChildOf(wireContext))
		}
		defer span.Finish()

		ctx := opentracing.ContextWithSpan(req.Context(), span)
		req = req.WithContext(ctx)
		start := time.Now()

		c.Next()

		status := rw.Status()

		span.LogFields(
			tlog.Int("http.status_code", status),
			tlog.Float64("waited.millis", float64(time.Since(start)/time.Millisecond)))
	}
}
