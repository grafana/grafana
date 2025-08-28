package migration

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "dashboard_migration"
)

var (
	// MDashboardConversionSuccessTotal is a metric counter for successful dashboard conversions
	MDashboardConversionSuccessTotal *prometheus.CounterVec

	// MDashboardConversionFailureTotal is a metric counter for failed dashboard conversions
	MDashboardConversionFailureTotal *prometheus.CounterVec

	// MDashboardSchemaMigrationSuccessTotal is a metric counter for successful dashboard schema migrations
	MDashboardSchemaMigrationSuccessTotal *prometheus.CounterVec

	// MDashboardSchemaMigrationFailureTotal is a metric counter for failed dashboard schema migrations
	MDashboardSchemaMigrationFailureTotal *prometheus.CounterVec
)

func init() {
	MDashboardConversionSuccessTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "conversion_success_total",
		Help:      "Total number of successful dashboard conversions",
	}, []string{"source_version_api", "target_version_api", "source_schema_version", "target_schema_version"})

	MDashboardConversionFailureTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "conversion_failure_total",
		Help:      "Total number of failed dashboard conversions",
	}, []string{"source_version_api", "target_version_api", "source_schema_version", "target_schema_version", "error_type"})

	MDashboardSchemaMigrationSuccessTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "schema_migration_success_total",
		Help:      "Total number of successful dashboard schema migrations",
	}, []string{"source_schema_version", "target_schema_version"})

	MDashboardSchemaMigrationFailureTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "schema_migration_failure_total",
		Help:      "Total number of failed dashboard schema migrations",
	}, []string{"source_schema_version", "target_schema_version", "error_type"})
}

// RegisterMetrics registers all migration metrics with the provided Prometheus registerer
func RegisterMetrics(reg prometheus.Registerer) {
	if reg != nil {
		reg.MustRegister(
			MDashboardConversionSuccessTotal,
			MDashboardConversionFailureTotal,
			MDashboardSchemaMigrationSuccessTotal,
			MDashboardSchemaMigrationFailureTotal,
		)
	}
}
