package controller

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var repositoryQuotaStalenessBuckets = []float64{
	0,
	time.Minute.Seconds(),
	(5 * time.Minute).Seconds(),
	(15 * time.Minute).Seconds(),
	(30 * time.Minute).Seconds(),
	time.Hour.Seconds(),
	(3 * time.Hour).Seconds(),
	(6 * time.Hour).Seconds(),
	(12 * time.Hour).Seconds(),
	(24 * time.Hour).Seconds(),
}

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
