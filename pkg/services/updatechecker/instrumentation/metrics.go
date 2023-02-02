package instrumentation

import "github.com/prometheus/client_golang/prometheus"

// PrometheusMetrics groups some metrics for an InstrumentedHTTPClient
type PrometheusMetrics struct {
	requestsCounter          prometheus.Counter
	failureCounter           prometheus.Counter
	durationSecondsHistogram prometheus.Histogram
	inFlightGauge            prometheus.Gauge
}

// NewPrometheusMetrics returns a new *PrometheusMetrics with pre-filled metrics, with the specified prefix
func NewPrometheusMetrics(prefix string) *PrometheusMetrics {
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
//	var svcMetrics = NewPrometheusMetrics("my_client").WithMustRegister(prometheus.DefaultRegisterer)
func (m *PrometheusMetrics) WithMustRegister(registry prometheus.Registerer) *PrometheusMetrics {
	m.MustRegister(registry)
	return m
}
