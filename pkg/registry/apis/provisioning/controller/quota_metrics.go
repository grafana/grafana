package controller

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Use finer resolution during the first hour after the last successful quota
// refresh, then track prolonged reliance on cached quota at 3, 6, 12, and 24 hours.
var repositoryQuotaAgeBuckets = []float64{
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
	age     prometheus.Histogram
	changes prometheus.Counter
}

func registerRepositoryQuotaMetrics(registry prometheus.Registerer) *repositoryQuotaMetrics {
	age := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name:    "grafana_provisioning_repository_quota_age_seconds",
		Help:    "Age of cached repository quota limits used after a quota refresh failure.",
		Buckets: repositoryQuotaAgeBuckets,
	})
	changes := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "grafana_provisioning_repository_quota_changes_total",
		Help: "Total number of repository quota limit changes observed by the controller.",
	})
	registry.MustRegister(age, changes)

	return &repositoryQuotaMetrics{age: age, changes: changes}
}

func (m *repositoryQuotaMetrics) observeAge(age time.Duration) {
	if m == nil {
		return
	}
	if age < 0 {
		age = 0
	}
	m.age.Observe(age.Seconds())
}

func (m *repositoryQuotaMetrics) recordChange() {
	if m == nil {
		return
	}
	m.changes.Inc()
}
