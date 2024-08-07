package remotecache

import (
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
)

const (
	cacheHit   = "hit"
	cacheMiss  = "miss"
	cacheError = "error"
)

var cacheStatuses = []string{cacheHit, cacheMiss, cacheError}

const (
	metricsNamespace = "grafana"
)

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		cacheUsage: metricutil.NewCounterVecStartingAtZero(prometheus.CounterOpts{
			Name:      "remote_cache_usage",
			Help:      "remote cache hit/miss",
			Namespace: metricsNamespace,
		}, []string{"status"}, map[string][]string{"status": cacheStatuses}),
	}

	if reg != nil {
		reg.MustRegister(m.cacheUsage)
	}

	return m
}

type metrics struct {
	cacheUsage *prometheus.CounterVec
}
