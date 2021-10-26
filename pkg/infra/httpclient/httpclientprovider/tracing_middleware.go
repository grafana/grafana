package httpclientprovider

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const (
	TracingMiddlewareName   = "tracing"
	httpContentLengthTagKey = "http.content_length"
)

func TracingMiddleware(ctx context.Context, logger log.Logger) httpclient.Middleware {
	return httpclient.NamedMiddlewareFunc(TracingMiddlewareName, func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			ctx, span := tracing.Tracer.Start(ctx, "HTTP Outgoing Request", trace.WithSpanKind(trace.SpanKindClient))
			defer span.End()

			req = req.WithContext(ctx)
			for k, v := range opts.Labels {
				span.SetAttributes(attribute.Key(k).String(v))
			}

			otel.GetTextMapPropagator().Inject(ctx, propagation.HeaderCarrier(req.Header))

			res, err := next.RoundTrip(req)

			span.SetAttributes(attribute.String("HTTP request URL", req.URL.String()))
			span.SetAttributes(attribute.String("HTTP request method", req.Method))

			if err != nil {
				span.RecordError(err)
				return res, err
			}

			if res != nil {
				// we avoid measuring contentlength less than zero because it indicates
				// that the content size is unknown. https://godoc.org/github.com/badu/http#Response
				if res.ContentLength > 0 {
					span.SetAttributes(attribute.Key(httpContentLengthTagKey).Int64(res.ContentLength))

				}
				span.SetAttributes(attribute.Int("HTTP response status code", res.StatusCode))

				if res.StatusCode >= 400 {
					span.SetStatus(codes.Error, fmt.Sprintf("error with HTTP status code %s", strconv.Itoa(res.StatusCode)))
				}
			}

			return res, err
		})
	})
}
