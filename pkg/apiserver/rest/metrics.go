package rest

import (
	"fmt"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/klog/v2"
)

type dualWriterMetrics struct {
	legacy        *prometheus.HistogramVec
	storage       *prometheus.HistogramVec
	outcome       *prometheus.HistogramVec
	syncer        *prometheus.HistogramVec
	syncerOutcome *prometheus.HistogramVec
}

// DualWriterStorageDuration is a metric summary for dual writer storage duration per mode
var DualWriterStorageDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_storage_duration_seconds",
	Help:                        "Histogram for the runtime of dual writer storage duration per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"is_error", "mode", "resource", "method"})

// DualWriterLegacyDuration is a metric summary for dual writer legacy duration per mode
var DualWriterLegacyDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_legacy_duration_seconds",
	Help:                        "Histogram for the runtime of dual writer legacy duration per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"is_error", "mode", "resource", "method"})

// DualWriterOutcome is a metric summary for dual writer outcome comparison between the 2 stores per mode
var DualWriterOutcome = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_outcome",
	Help:                        "Histogram for the runtime of dual writer outcome comparison between the 2 stores per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"mode", "name", "method"})

var DualWriterReadLegacyCounts = prometheus.NewCounterVec(prometheus.CounterOpts{
	Name:      "dual_writer_read_legacy_count",
	Help:      "Histogram for the runtime of dual writer reads from legacy",
	Namespace: "grafana",
}, []string{"resource", "method"})

// DualWriterSyncerDuration is a metric summary for dual writer sync duration per mode
var DualWriterSyncerDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_data_syncer_duration_seconds",
	Help:                        "Histogram for the runtime of dual writer data syncer duration per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"is_error", "mode", "resource"})

// DualWriterDataSyncerOutcome is a metric summary for dual writer data syncer outcome comparison between the 2 stores per mode
var DualWriterDataSyncerOutcome = prometheus.NewHistogramVec(prometheus.HistogramOpts{
	Name:                        "dual_writer_data_syncer_outcome",
	Help:                        "Histogram for the runtime of dual writer data syncer outcome comparison between the 2 stores per mode",
	Namespace:                   "grafana",
	NativeHistogramBucketFactor: 1.1,
}, []string{"mode", "resource"})

func (m *dualWriterMetrics) init(reg prometheus.Registerer) {
	log := klog.NewKlogr()
	m.legacy = DualWriterLegacyDuration
	m.storage = DualWriterStorageDuration
	m.outcome = DualWriterOutcome
	m.syncer = DualWriterSyncerDuration
	m.syncerOutcome = DualWriterDataSyncerOutcome
	errLegacy := reg.Register(m.legacy)
	errStorage := reg.Register(m.storage)
	errOutcome := reg.Register(m.outcome)
	errSyncer := reg.Register(m.syncer)
	errSyncerOutcome := reg.Register(m.syncerOutcome)
	if errLegacy != nil || errStorage != nil || errOutcome != nil || errSyncer != nil || errSyncerOutcome != nil {
		log.Info("cloud migration metrics already registered")
	}
}

func (m *dualWriterMetrics) recordLegacyDuration(isError bool, mode string, resource string, method string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.legacy.WithLabelValues(strconv.FormatBool(isError), mode, resource, method).Observe(duration)
}

func (m *dualWriterMetrics) recordStorageDuration(isError bool, mode string, resource string, method string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.storage.WithLabelValues(strconv.FormatBool(isError), mode, resource, method).Observe(duration)
}

func (m *dualWriterMetrics) recordOutcome(mode string, name string, areEqual bool, method string) {
	var observeValue float64
	if !areEqual {
		observeValue = 1
	}
	m.outcome.WithLabelValues(mode, name, method).Observe(observeValue)
}

func (m *dualWriterMetrics) recordDataSyncerDuration(isError bool, mode DualWriterMode, resource string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.syncer.WithLabelValues(strconv.FormatBool(isError), fmt.Sprintf("%d", mode), resource).Observe(duration)
}

func (m *dualWriterMetrics) recordDataSyncerOutcome(mode DualWriterMode, resource string, synced bool) {
	var observeValue float64
	if !synced {
		observeValue = 1
	}
	m.syncerOutcome.WithLabelValues(fmt.Sprintf("%d", mode), resource).Observe(observeValue)
}
