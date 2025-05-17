package httpclientprovider

import (
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/prometheus/client_golang/prometheus"
)

// PrometheusMetrics groups some metrics for a PrometheusMetricsMiddleware
type PrometheusMetrics struct {
	requestsCounter          prometheus.Counter
	failureCounter           prometheus.Counter
	durationSecondsHistogram prometheus.Histogram
	inFlightGauge            prometheus.Gauge
}

// NewPrometheusMetricsMiddleware returns a new *PrometheusMetrics with pre-filled metrics, with the specified prefix
func NewPrometheusMetricsMiddleware(prefix string) *PrometheusMetrics {
	return &PrometheusMetrics{
		requestsCounter: prometheus.NewCounter(prometheus.CounterOpts{
			Name: prefix + "_request_total",
		}),
		failureCounter: prometheus.NewCounter(prometheus.CounterOpts{
			Name: prefix + "_failure_total",
		}),
		durationSecondsHistogram: prometheus.NewHistogram(prometheus.HistogramOpts{
			Name: prefix + "_request_duration_seconds",
		}),
		inFlightGauge: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: prefix + "_in_flight_request",
		}),
	}
}

// Register registers the metrics in the current PrometheusMetrics into the provided registry
func (m *PrometheusMetrics) Register(registry prometheus.Registerer) error {
	for _, collector := range []prometheus.Collector{
		m.requestsCounter, m.failureCounter, m.durationSecondsHistogram, m.inFlightGauge,
	} {
		if err := registry.Register(collector); err != nil {
			return err
		}
	}
	return nil
}

// MustRegister is like Register, but, in case of failure, it panics instead of returning an error
func (m *PrometheusMetrics) MustRegister(registry prometheus.Registerer) {
	if err := m.Register(registry); err != nil {
		panic(err)
	}
}

// WithMustRegister calls MustRegister and returns itself. This is to allow to chain the method call
// upon initialization, useful when declaring metrics in the global scope:
//
//	var svcMetrics = NewPrometheusMetricsMiddleware("my_client").WithMustRegister(prometheus.DefaultRegisterer)
func (m *PrometheusMetrics) WithMustRegister(registry prometheus.Registerer) *PrometheusMetrics {
	m.MustRegister(registry)
	return m
}

// PrometheusMetricsMiddleware is a middleware that will mutate the in flight, requests, duration and
// failure count on the provided *PrometheusMetrics instance. This can be used to count the number of requests,
// successful requests and errors that go through the httpclient, as well as to track the response times.
// For the metrics to be exposed properly, the provided *PrometheusMetrics should already be registered in a Prometheus
// registry.
func PrometheusMetricsMiddleware(metrics *PrometheusMetrics) httpclient.Middleware {
	return httpclient.MiddlewareFunc(func(opts httpclient.Options, next http.RoundTripper) http.RoundTripper {
		return httpclient.RoundTripperFunc(func(req *http.Request) (*http.Response, error) {
			startTime := time.Now()
			metrics.inFlightGauge.Inc()

			res, err := next.RoundTrip(req)

			metrics.inFlightGauge.Dec()
			metrics.requestsCounter.Inc()
			metrics.durationSecondsHistogram.Observe(time.Since(startTime).Seconds())
			if err != nil || (res != nil && (res.StatusCode < 200 || res.StatusCode > 299)) {
				metrics.failureCounter.Inc()
			}

			return res, err
		})
	})
}
