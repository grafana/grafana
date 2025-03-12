package query

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "queryservice"
	metricsNamespace = "grafana"
)

type queryMetrics struct {
	dsRequests  *prometheus.CounterVec
	dsResponses *prometheus.CounterVec

	// older metric
	expressionsQuerySummary *prometheus.SummaryVec
}

func newQueryMetrics(reg prometheus.Registerer) *queryMetrics {
	m := &queryMetrics{
		dsRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "ds_queries_total",
			Help:      "Number of datasource queries made from the query service",
		}, []string{"error", "dataplane", "datasource_type"}),

		dsResponses: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "plugin_request_total",
			Help:      "The total amount of plugin requests",
		}, []string{"plugin_id", "status", "status_source"}),

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
