package query

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "queryservice"
	metricsNamespace = "grafana"

	compareResultError     = "error"
	compareResultEqual     = "equal"
	compareResultDifferent = "different"

	compareLabelResult         = "result"
	compareLabelDatasourceType = "datasource_type"
)

type metrics struct {
	dsRequests        *prometheus.CounterVec
	dsCompare         *prometheus.CounterVec
	queryDurationDiff *prometheus.HistogramVec

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
		dsCompare: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "ds_compare_results_total",
			Help:      "Comparison results in passive mode from the query service",
		}, []string{compareLabelResult, compareLabelDatasourceType}),
		queryDurationDiff: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "query_duration_difference_seconds",
				Help:    "Difference in duration between single and multi-tenant queries in seconds",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"datasource_type"},
		),
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
			m.dsCompare,
			m.queryDurationDiff,
			m.expressionsQuerySummary,
		)
	}

	return m
}
