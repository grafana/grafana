package updatechecker

import (
	"context"
	"fmt"
	"github.com/grafana/grafana/pkg/infra/tracing"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
	"io"
	"net/http"
)

type httpClient interface {
	Get(ctx context.Context, url string) (resp *http.Response, err error)
}

// instrumentedHTTPClient is an HTTP client that wraps every request a span, tracking the method, url,
// and response code as span attributes.
type instrumentedHTTPClient struct {
	*http.Client
	tracer tracing.Tracer

	// spanName is the name that request spans will have.
	spanName string
}

// defaultInstrumentedHTTPClientSpanName is the default span name for spans created by instrumentedHTTPClient
const defaultInstrumentedHTTPClientSpanName = "instrumentedHTTPClient.request"

// newInstrumentedHTTPClient returns a new usable instrumentedHTTPClient.
func newInstrumentedHTTPClient(cl *http.Client, tracer tracing.Tracer) *instrumentedHTTPClient {
	return &instrumentedHTTPClient{
		Client:   cl,
		tracer:   tracer,
		spanName: defaultInstrumentedHTTPClientSpanName,
	}
}

// request performs a request, wrapping it in a new span. The method, url and response status code will be tracked
// as span attributes. Any errors will be recorded in the span as well.
func (r instrumentedHTTPClient) request(ctx context.Context, method string, url string, body io.Reader) (*http.Response, error) {
	if r.Timeout > 0 {
		var canc func()
		ctx, canc = context.WithTimeout(ctx, r.Timeout)
		defer canc()
	}
	ctx, span := r.tracer.Start(
		ctx,
		r.spanName,
		trace.WithSpanKind(trace.SpanKindClient),
		trace.WithAttributes(
			semconv.HTTPMethodKey.String(method),
			semconv.HTTPTargetKey.String(url),
		),
	)
	defer span.End()
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		span.RecordError(err)
		return nil, fmt.Errorf("new request: %w", err)
	}
	resp, err := r.Client.Do(req)
	if err != nil {
		span.RecordError(err)
		return nil, err
	}
	return resp, err
}

// Get performs an instrumented Get request.
func (r instrumentedHTTPClient) Get(ctx context.Context, url string) (*http.Response, error) {
	return r.request(ctx, http.MethodGet, url, nil)
}
