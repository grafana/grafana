package ring

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "remote_cache_ring"
	metricsNamespace = "grafana"
)

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		cacheUsage: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name:      "remote_cache_ring_usage",
			Help:      "remote cache hit/miss",
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
		}, []string{"backend"}),
	}

	if reg != nil {
		reg.MustRegister(m.cacheUsage)
	}

	return m
}

type metrics struct {
	cacheUsage *prometheus.CounterVec
}
