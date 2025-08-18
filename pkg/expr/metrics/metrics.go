package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
)

// ExprMetrics is a struct that contains all the metrics for an implementation of the expressions service
// shared between multiple versions of expressions service, which are delineated by the subsystem string
type ExprMetrics struct {
	DSRequests              *prometheus.CounterVec
	ExpressionsQuerySummary *prometheus.SummaryVec
	SqlCommandDuration      *prometheus.HistogramVec
	SqlCommandCount         *prometheus.CounterVec
	SqlCommandCellCount     *prometheus.HistogramVec
	SqlCommandInputCount    *prometheus.CounterVec
}

func newExprMetrics(subsystem string) *ExprMetrics {
	return &ExprMetrics{
		DSRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: subsystem,
			Name:      "ds_queries_total",
			Help:      "Number of datasource queries made via server side expression requests",
		}, []string{"error", "dataplane", "datasource_type"}),

		ExpressionsQuerySummary: prometheus.NewSummaryVec(
			prometheus.SummaryOpts{
				Namespace:  "grafana",
				Subsystem:  subsystem,
				Name:       "expressions_queries_duration_milliseconds",
				Help:       "Expressions query summary",
				Objectives: map[float64]float64{0.5: 0.05, 0.9: 0.01, 0.99: 0.001},
			},
			[]string{"status"},
		),

		SqlCommandDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Namespace: "grafana",
			Subsystem: subsystem,
			Name:      "sql_command_duration_milliseconds",
			Help:      "Duration of SQL command execution in milliseconds",
			Buckets:   []float64{100, 200, 300, 500, 750, 1000, 2000, 5000, 10000},
		}, []string{"status"}),

		SqlCommandCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: subsystem,
			Name:      "sql_command_count",
			Help:      "Total number of SQL command executions with a status label and error_type for more detailed categorization of errors. When there is no error, error_type is 'none'.",
		}, []string{"status", "error_type"}),

		SqlCommandCellCount: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "grafana",
				Subsystem: subsystem,
				Name:      "sql_command_cell_count",
				Help:      "Distribution of the total number of cells in each SQL command execution",
				Buckets:   prometheus.ExponentialBuckets(100, 2, 10),
			},
			[]string{"status"},
		),

		SqlCommandInputCount: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Subsystem: subsystem,
			Name:      "sql_command_input_count",
			Help:      "Total number of inputs to the SQL command. Errors here are also counted in the sql_command_count metric but without the datasource_type. The converted label indicates if the input was converted from another format (e.g. from labeled time series) or passed through as a table. Since a single SQL expression can have multiple inputs, this can count higher than sql_command_count.",
		}, []string{"status", "converted", "datasource_type"}),
	}
}

// NewSSEMetrics creates a new ExprMetrics struct for the ST implementation of the expressions service
func NewSSEMetrics(reg prometheus.Registerer) *ExprMetrics {
	metricsSubSystem := "sse"

	m := &ExprMetrics{
		DSRequests: newExprMetrics(metricsSubSystem).DSRequests,

		ExpressionsQuerySummary: newExprMetrics(metricsSubSystem).ExpressionsQuerySummary,

		SqlCommandDuration: newExprMetrics(metricsSubSystem).SqlCommandDuration,

		SqlCommandCount: newExprMetrics(metricsSubSystem).SqlCommandCount,

		SqlCommandCellCount: newExprMetrics(metricsSubSystem).SqlCommandCellCount,

		SqlCommandInputCount: newExprMetrics(metricsSubSystem).SqlCommandInputCount,
	}

	if reg != nil {
		reg.MustRegister(
			m.DSRequests,
			m.ExpressionsQuerySummary,
			m.SqlCommandDuration,
			m.SqlCommandCount,
			m.SqlCommandCellCount,
			m.SqlCommandInputCount,
		)
	}

	return m
}

// NewQueryServiceExpressionsMetrics creates a new ExprMetrics struct for the query service implementation of the expressions service
func NewQueryServiceExpressionsMetrics(reg prometheus.Registerer) *ExprMetrics {
	metricsSubSystem := "queryservice"

	m := &ExprMetrics{
		DSRequests: newExprMetrics(metricsSubSystem).DSRequests,

		ExpressionsQuerySummary: newExprMetrics(metricsSubSystem).ExpressionsQuerySummary,

		SqlCommandDuration: newExprMetrics(metricsSubSystem).SqlCommandDuration,

		SqlCommandCount: newExprMetrics(metricsSubSystem).SqlCommandCount,

		SqlCommandCellCount: newExprMetrics(metricsSubSystem).SqlCommandCellCount,

		SqlCommandInputCount: newExprMetrics(metricsSubSystem).SqlCommandInputCount,
	}

	if reg != nil {
		reg.MustRegister(
			m.DSRequests,
			m.ExpressionsQuerySummary,
			m.SqlCommandDuration,
			m.SqlCommandCount,
			m.SqlCommandCellCount,
			m.SqlCommandInputCount,
		)
	}

	return m
}

func NewTestMetrics() *ExprMetrics {
	return newExprMetrics("test")
}
