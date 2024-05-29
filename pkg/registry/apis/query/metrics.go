package query

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "queryservice"
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
			Help:      "Number of datasource queries made from the query service",
		}, []string{"error", "dataplane", "datasource_type"}),

		expressionsQuerySummary: prometheus.NewSummaryVec(
			prometheus.SummaryOpts{
				Namespace:  metricsNamespace,
				Subsystem:  metricsSubSystem,
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
