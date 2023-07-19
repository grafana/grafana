package expr

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "sse"
	metricsNamespace = "grafana"
)

type metrics struct {
	dsRequests *prometheus.CounterVec

	// older metric
	expressionsQuerySummary *prometheus.SummaryVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		dsRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "ds_queries_total",
			Help:      "Number of datasource queries made via server side expression requests",
		}, []string{"error", "dataplane"}),

		// older (No Namespace or Subsystem)
		expressionsQuerySummary: prometheus.NewSummaryVec(
			prometheus.SummaryOpts{
				Name:       "expressions_queries_duration_milliseconds",
				Help:       "Expressions query summary",
				Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
			},
			[]string{"status"},
		),
	}

	if reg != nil {
		reg.MustRegister(
			m.dsRequests,
			m.expressionsQuerySummary,
		)
	}

	return m
}
