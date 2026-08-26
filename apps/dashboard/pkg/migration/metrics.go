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

	// MDashboardConversionDuration is a metric histogram for the duration of dashboard conversions
	MDashboardConversionDuration *prometheus.HistogramVec

	// MDashboardConversionObjectSizeBytes is a metric histogram for the JSON-encoded size of
	// the dashboard being converted
	MDashboardConversionObjectSizeBytes *prometheus.HistogramVec
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

	MDashboardConversionDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "conversion_duration_seconds",
		Help:      "Wall-clock duration of the dashboard conversion path in seconds, including source size measurement and the data-loss check",
		// Exponential buckets spanning ~0.5ms to ~65s so both fast conversions and
		// the multi-second tail (large dashboards) get resolution.
		Buckets: prometheus.ExponentialBucketsRange(0.0005, 65, 8),
	}, []string{"source_version_api", "target_version_api", "outcome"})

	MDashboardConversionObjectSizeBytes = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Namespace: metricsNamespace,
		Subsystem: metricsSubSystem,
		Name:      "conversion_object_size_bytes",
		Help:      "JSON-encoded size in bytes of the dashboard being converted",
		// Exponential buckets spanning 1KB to 32MB. Current dashboards go up to ~20MB;
		// the range leaves headroom for larger objects in the future.
		Buckets: prometheus.ExponentialBucketsRange(1024, 32*1024*1024, 8),
	}, []string{"source_version_api", "target_version_api", "outcome"})
}

// RegisterMetrics registers all migration metrics with the provided Prometheus registerer
func RegisterMetrics(reg prometheus.Registerer) {
	if reg != nil {
		reg.MustRegister(
			MDashboardConversionSuccessTotal,
			MDashboardConversionFailureTotal,
			MDashboardConversionDuration,
			MDashboardConversionObjectSizeBytes,
		)
	}
}
