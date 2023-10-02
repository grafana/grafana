package idimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "idforwarding"
)

func newMetircus(reg prometheus.Registerer) *metrics {
	m := &metrics{
		tokenSigningCounter: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "idforwarding_token_sining_total",
			Help:      "Number of token signings",
		}),
		tokenSigningFromCacheCounter: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "idforwarding_token_signing_from_cache_total",
			Help:      "Number of signed tokens retrieved from cahce",
		}),
		failedTokenSingingCounter: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "idforwarding_failed_token_sining_total",
			Help:      "Number of failed token singings",
		}),

		tokenSigningDurationHistogram: prometheus.NewHistogram(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "idfowrading_token_signing_duration_seconds",
			Help:      "Histrogram of token signing duration",
			Buckets:   []float64{0.1, 0.25, 0.5, 1, 2, 5, 10},
		}),
	}

	if reg != nil {
		reg.MustRegister(m.tokenSigningCounter)
		reg.MustRegister(m.tokenSigningFromCacheCounter)
		reg.MustRegister(m.failedTokenSingingCounter)
		reg.MustRegister(m.tokenSigningDurationHistogram)
	}

	return m
}

type metrics struct {
	tokenSigningCounter           prometheus.Counter
	tokenSigningFromCacheCounter  prometheus.Counter
	failedTokenSingingCounter     prometheus.Counter
	tokenSigningDurationHistogram prometheus.Histogram
}
