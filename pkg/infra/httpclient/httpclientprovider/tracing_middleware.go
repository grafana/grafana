package httpclientprovider

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/ext"
)

const (
	TracingMiddlewareName   = "tracing"
	httpContentLengthTagKey = "http.content_length"
)

func TracingMiddleware(logger log.Logger) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(TracingMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			span, ctx := opentracing.StartSpanFromContext(req.Context(), "HTTP Outgoing Request")
			defer span.Finish()

			req = req.WithContext(ctx)
			for k, v := range opts.Labels {
				span.SetTag(k, v)
			}

			if err := opentracing.GlobalTracer().Inject(
				span.Context(),
				opentracing.HTTPHeaders,
				opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
				logger.Error("Failed to inject span context instance", "err", err)
			}

			res, err := next.RoundTrip(req)

			ext.HTTPUrl.Set(span, req.URL.String())
			ext.HTTPMethod.Set(span, req.Method)
			ext.SpanKind.Set(span, ext.SpanKindRPCClientEnum)

			if err != nil {
				ext.Error.Set(span, true)
				return res, err
			}

			if res != nil {
				// we avoid measuring contentlength less than zero because it indicates
				// that the content size is unknown. https://godoc.org/github.com/badu/http#Response
				if res.ContentLength > 0 {
					span.SetTag(httpContentLengthTagKey, res.ContentLength)
				}

				ext.HTTPStatusCode.Set(span, uint16(res.StatusCode))
				if res.StatusCode >= 400 {
					ext.Error.Set(span, true)
				}
			}

			return res, err
		})
	})
}
