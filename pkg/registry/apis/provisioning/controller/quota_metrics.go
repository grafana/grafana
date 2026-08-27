package controller

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var repositoryQuotaStalenessBuckets = []float64{0, 60, 300, 900, 1800, 3600, 10800, 21600, 43200, 86400}

type repositoryQuotaMetrics struct {
	staleness prometheus.Histogram
}

func registerRepositoryQuotaMetrics(registry prometheus.Registerer) *repositoryQuotaMetrics {
	staleness := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_repository_quota_staleness_seconds",
		Help:    "Age of cached repository quota limits used after a quota refresh failure.",
		Buckets: repositoryQuotaStalenessBuckets,
	})
	registry.MustRegister(staleness)

	return &repositoryQuotaMetrics{staleness: staleness}
}

func (m *repositoryQuotaMetrics) observeStaleness(age time.Duration) {
	if m == nil {
		return
	}
	if age < 0 {
		age = 0
	}
	m.staleness.Observe(age.Seconds())
}
