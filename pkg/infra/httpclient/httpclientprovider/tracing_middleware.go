package httpclientprovider

import (
	"fmt"
	"net/http"
	"net/http/httptrace"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

const (
	TracingMiddlewareName   = "tracing"
	httpContentLengthTagKey = "http.content_length"
)

func TracingMiddleware(logger log.Logger, tracer tracing.Tracer) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(TracingMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			ctx, span := tracer.Start(req.Context(), "HTTP Outgoing Request", trace.WithSpanKind(trace.SpanKindClient))
			defer span.End()

			ctx = httptrace.WithClientTrace(ctx, otelhttptrace.NewClientTrace(ctx, otelhttptrace.WithoutSubSpans(), otelhttptrace.WithoutHeaders()))
			req = req.WithContext(ctx)
			for k, v := range opts.Labels {
				span.SetAttributes(attribute.String(k, v))
			}

			tracer.Inject(ctx, req.Header, span)
			res, err := next.RoundTrip(req)

			span.SetAttributes(semconv.HTTPURL(req.URL.String()))
			span.SetAttributes(semconv.HTTPMethod(req.Method))
			// ext.SpanKind.Set(span, ext.SpanKindRPCClientEnum)

			if err != nil {
				span.SetStatus(codes.Error, "request failed")
				span.RecordError(err)
				return res, err
			}

			if res != nil {
				// we avoid measuring contentlength less than zero because it indicates
				// that the content size is unknown. https://godoc.org/github.com/badu/http#Response
				if res.ContentLength > 0 {
					span.SetAttributes(attribute.Int64(httpContentLengthTagKey, res.ContentLength))
				}

				span.SetAttributes(semconv.HTTPStatusCode(res.StatusCode))
				if res.StatusCode >= 400 {
					span.SetStatus(codes.Error, fmt.Sprintf("error with HTTP status code %s", strconv.Itoa(res.StatusCode)))
				}
			}

			return res, err
		})
	})
}
