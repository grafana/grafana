package acimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

type fallbackMetrics struct {
	comparisons *prometheus.CounterVec
	duration    *prometheus.HistogramVec
	checks      *prometheus.CounterVec
}

func newFallbackMetrics(reg prometheus.Registerer) *fallbackMetrics {
	m := &fallbackMetrics{
		comparisons: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "accesscontrol_fallback",
			Name:      "comparisons_total",
			Help:      "Comparison outcomes between legacy RBAC and Zanzana fallback evaluation.",
		}, []string{"result"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "accesscontrol_fallback",
			Name:      "engine_duration_seconds",
			Help:      "Evaluation duration for each fallback rollout engine.",
			Buckets:   prometheus.DefBuckets,
		}, []string{"engine"}),
		checks: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "accesscontrol_fallback",
			Name:      "checks_total",
			Help:      "Generic Zanzana fallback permission checks by outcome.",
		}, []string{"result"}),
	}
	if reg != nil {
		reg.MustRegister(m.comparisons, m.duration, m.checks)
	}
	return m
}
