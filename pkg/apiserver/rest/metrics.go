package rest

import (
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/klog/v2"
)

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
}, []string{"is_error", "mode", "kind", "method"})

// DualWriterLegacyDuration is a metric summary for dual writer legacy duration per mode
var DualWriterLegacyDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_legacy_duration_seconds",
	Help:                        "Histogram for the runtime of dual writer legacy duration per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"is_error", "mode", "kind", "method"})

// DualWriterOutcome is a metric summary for dual writer outcome comparison between the 2 stores per mode
var DualWriterOutcome = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_outcome",
	Help:                        "Histogram for the runtime of dual writer outcome comparison between the 2 stores per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"mode", "name", "method"})

func (m *dualWriterMetrics) init(reg prometheus.Registerer) {
	log := klog.NewKlogr()
	m.legacy = DualWriterLegacyDuration
	m.storage = DualWriterStorageDuration
	m.outcome = DualWriterOutcome
	errLegacy := reg.Register(m.legacy)
	errStorage := reg.Register(m.storage)
	errOutcome := reg.Register(m.outcome)
	if errLegacy != nil || errStorage != nil || errOutcome != nil {
		log.Info("cloud migration metrics already registered")
	}
}

func (m *dualWriterMetrics) recordLegacyDuration(isError bool, mode string, name string, method string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.legacy.WithLabelValues(strconv.FormatBool(isError), mode, name, method).Observe(duration)
}

func (m *dualWriterMetrics) recordStorageDuration(isError bool, mode string, name string, method string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.storage.WithLabelValues(strconv.FormatBool(isError), mode, name, method).Observe(duration)
}

func (m *dualWriterMetrics) recordOutcome(mode string, name string, areEqual bool, method string) {
	var observeValue float64
	if !areEqual {
		observeValue = 1
	}
	m.outcome.WithLabelValues(mode, name, method).Observe(observeValue)
}
