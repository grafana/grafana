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
	// Labels are intentionally restricted to fixed engine/result enums. Actions,
	// scopes, and subjects would make these metrics both high-cardinality and sensitive.
	m := &fallbackMetrics{
		comparisons: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "accesscontrol_fallback",
			Name:      "comparisons_total",
			Help:      "Comparison outcomes between legacy RBAC and Zanzana permission evaluation.",
		}, []string{"result"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: "accesscontrol_fallback",
			Name:      "engine_duration_seconds",
			Help:      "Evaluation duration for each authorization rollout engine.",
			Buckets:   prometheus.DefBuckets,
		}, []string{"engine"}),
		checks: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: "accesscontrol_fallback",
			Name:      "checks_total",
			Help:      "Unified Zanzana legacy permission checks by outcome.",
		}, []string{"result"}),
	}
	if reg != nil {
		reg.MustRegister(m.comparisons, m.duration, m.checks)
	}
	return m
}
