package instrumentation

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

// InstrumentedHTTPClient is an HTTP client that wraps every request a span, tracking the method, url,
// and response code as span attributes.
type InstrumentedHTTPClient struct {
	*http.Client
	tracer tracing.Tracer

	// spanName is the name that request spans will have.
	spanName string

	metrics *PrometheusMetrics
}

// defaultSpanName is the default span name for spans created by InstrumentedHTTPClient
const defaultSpanName = "InstrumentedHTTPClient.request"

// NewInstrumentedHTTPClient returns a new usable InstrumentedHTTPClient
func NewInstrumentedHTTPClient(cl *http.Client, tracer tracing.Tracer, opts ...InstrumentedHTTPClientOption) *InstrumentedHTTPClient {
	r := &InstrumentedHTTPClient{
		Client:   cl,
		tracer:   tracer,
		spanName: defaultSpanName,
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// InstrumentedHTTPClientOption is a function that mutates the provided InstrumentedHTTPClient
type InstrumentedHTTPClientOption func(cl *InstrumentedHTTPClient)

// WithSingleMetrics takes some prometheus collectors and sets them into cl.metrics
func WithSingleMetrics(
	requestsCounter, failureCounter prometheus.Counter,
	durationSecondsHistogram prometheus.Histogram,
	inFlightGauge prometheus.Gauge,
) InstrumentedHTTPClientOption {
	return func(cl *InstrumentedHTTPClient) {
		cl.metrics = &PrometheusMetrics{
			requestsCounter:          requestsCounter,
			failureCounter:           failureCounter,
			durationSecondsHistogram: durationSecondsHistogram,
			inFlightGauge:            inFlightGauge,
		}
	}
}

// WithMetrics is like WithSingleMetrics, but it accepts a *PrometheusMetrics (grouped) rather than each
// metric in a separate argument
func WithMetrics(metrics *PrometheusMetrics) InstrumentedHTTPClientOption {
	return WithSingleMetrics(
		metrics.requestsCounter, metrics.failureCounter, metrics.durationSecondsHistogram, metrics.inFlightGauge,
	)
}

// request performs a request, wrapping it in a new span. The method, url and response status code will be tracked
// as span attributes. Any errors will be recorded in the span as well.
func (r *InstrumentedHTTPClient) request(ctx context.Context, method string, url string, body io.Reader) (*http.Response, error) {
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

	var err error
	startTime := time.Now()

	hasMetrics := r.metrics != nil
	if hasMetrics {
		r.metrics.inFlightGauge.Inc()
	}
	defer func() {
		if hasMetrics {
			r.metrics.inFlightGauge.Dec()
			r.metrics.requestsCounter.Inc()
			r.metrics.durationSecondsHistogram.Observe(time.Since(startTime).Seconds())
		}
		if err != nil {
			if hasMetrics {
				r.metrics.failureCounter.Inc()
			}
			span.RecordError(err)
		}
	}()

	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	resp, err := r.Client.Do(req)
	if err != nil {
		return nil, err
	}
	return resp, err
}

// Get performs an instrumented Get request.
func (r *InstrumentedHTTPClient) Get(ctx context.Context, url string) (*http.Response, error) {
	return r.request(ctx, http.MethodGet, url, nil)
}
