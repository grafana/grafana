package rest

import "github.com/prometheus/client_golang/prometheus"

type dualWriterMetrics struct {
	legacy  *prometheus.HistogramVec
	storage *prometheus.HistogramVec
	outcome *prometheus.HistogramVec
}

// DualWriterStorageDuration is a metric summary for dual writer storage duration per mode
var DualWriterStorageDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_storage_duration_seconds",
	Help:                        "Histogram for the runtime of dual writer storage duration per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"status_code", "mode", "name", "method"})

// DualWriterLegacyDuration is a metric summary for dual writer legacy duration per mode
var DualWriterLegacyDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_legacy_duration_seconds",
	Help:                        "Histogram for the runtime of dual writer legacy duration per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"status_code", "mode", "name", "method"})

// DualWriterOutcome is a metric summary for dual writer outcome comparison between the 2 stores per mode
var DualWriterOutcome = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_outcome",
	Help:                        "Histogram for the runtime of dual writer outcome comparison between the 2 stores per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"mode", "name", "outcome", "method"})

func (m *dualWriterMetrics) init() {
	m.legacy = DualWriterLegacyDuration
	m.storage = DualWriterStorageDuration
	m.outcome = DualWriterOutcome
}

// nolint:unused
func (m *dualWriterMetrics) recordLegacyDuration(statusCode string, mode string, name string, method string, duration float64) {
	m.legacy.WithLabelValues(statusCode, mode, name, method).Observe(duration)
}

// nolint:unused
func (m *dualWriterMetrics) recordStorageDuration(statusCode string, mode string, name string, method string, duration float64) {
	m.storage.WithLabelValues(statusCode, mode, name, method).Observe(duration)
}

// nolint:unused
func (m *dualWriterMetrics) recordOutcome(mode string, name string, outcome string, method string) {
	m.outcome.WithLabelValues(mode, name, outcome, method).Observe(1)
}
