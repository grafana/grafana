package updatechecker

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

	requestsCounter   prometheus.Counter
	failureCounter    prometheus.Counter
	durationHistogram prometheus.Histogram
	inFlightCounter   prometheus.Gauge
}

// defaultInstrumentedHTTPClientSpanName is the default span name for spans created by instrumentedHTTPClient
const defaultInstrumentedHTTPClientSpanName = "instrumentedHTTPClient.request"

// newInstrumentedHTTPClient returns a new usable instrumentedHTTPClient.
func newInstrumentedHTTPClient(cl *http.Client, tracer tracing.Tracer, opts ...instrumentedHTTPClientOption) (*instrumentedHTTPClient, error) {
	r := &instrumentedHTTPClient{
		Client:   cl,
		tracer:   tracer,
		spanName: defaultInstrumentedHTTPClientSpanName,
	}
	for _, opt := range opts {
		if err := opt(r); err != nil {
			return nil, err
		}
	}
	return r, nil
}

// mustNewInstrumentedHTTPClient is like newInstrumentedHTTPClient, but it panics instead of returning an error.
func mustNewInstrumentedHTTPClient(cl *http.Client, tracer tracing.Tracer, opts ...instrumentedHTTPClientOption) *instrumentedHTTPClient {
	r, err := newInstrumentedHTTPClient(cl, tracer, opts...)
	if err != nil {
		panic(err)
	}
	return r
}

type instrumentedHTTPClientOption func(cl *instrumentedHTTPClient) error

func instrumentedHTTPClientWithMetrics(registerer prometheus.Registerer, prefix string) instrumentedHTTPClientOption {
	return func(cl *instrumentedHTTPClient) error {
		// TODO: helps
		cl.requestsCounter = prometheus.NewCounter(prometheus.CounterOpts{
			Name: prefix + "_request_total",
		})
		cl.failureCounter = prometheus.NewCounter(prometheus.CounterOpts{
			Name: prefix + "_failure_total",
		})
		cl.durationHistogram = prometheus.NewHistogram(prometheus.HistogramOpts{
			Name: prefix + "_request_duration_seconds",
		})
		cl.inFlightCounter = prometheus.NewGauge(prometheus.GaugeOpts{
			Name: prefix + "_in_flight_request_total",
		})
		return cl.registerMetrics(registerer)
	}
}

func (r *instrumentedHTTPClient) registerMetrics(registerer prometheus.Registerer) error {
	for _, collector := range []prometheus.Collector{
		r.requestsCounter, r.failureCounter, r.inFlightCounter, r.durationHistogram,
	} {
		if err := registerer.Register(collector); err != nil {
			return err
		}
	}
	return nil
}

// request performs a request, wrapping it in a new span. The method, url and response status code will be tracked
// as span attributes. Any errors will be recorded in the span as well.
func (r *instrumentedHTTPClient) request(ctx context.Context, method string, url string, body io.Reader) (*http.Response, error) {
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
	r.inFlightCounter.Inc()
	defer func() {
		r.inFlightCounter.Dec()
		r.requestsCounter.Inc()
		r.durationHistogram.Observe(time.Since(startTime).Seconds())
		if err != nil {
			r.failureCounter.Inc()
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
func (r *instrumentedHTTPClient) Get(ctx context.Context, url string) (*http.Response, error) {
	return r.request(ctx, http.MethodGet, url, nil)
}
