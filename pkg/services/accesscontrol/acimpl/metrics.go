package acimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "access"
	metricsNamespace = "grafana"
)

type serviceMetrics struct {
	zanzanaCheck            *prometheus.CounterVec
	engineEvaluationSummary *prometheus.HistogramVec
}

func newMetrics(reg prometheus.Registerer) *serviceMetrics {
	m := &serviceMetrics{
		zanzanaCheck: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "zanzana_evaluation_total",
			Help:      "Number of zanzana evaluations (success vs failures)",
		}, []string{"status"}),
		engineEvaluationSummary: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "engine_evaluation_duration_seconds",
			Help:      "Duration of evaluation for different access control engines",
		}, []string{"engine"}),
	}

	if reg != nil {
		reg.MustRegister(
			m.zanzanaCheck,
			m.engineEvaluationSummary,
		)
	}

	return m
}
