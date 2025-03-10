package rest

import (
	"fmt"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/klog/v2"
)

type dualWriterMetrics struct {
	syncer        *prometheus.HistogramVec
	syncerOutcome *prometheus.HistogramVec
}

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
	m.syncer = DualWriterSyncerDuration
	m.syncerOutcome = DualWriterDataSyncerOutcome
	errSyncer := reg.Register(m.syncer)
	errSyncerOutcome := reg.Register(m.syncerOutcome)
	if errSyncer != nil || errSyncerOutcome != nil {
		log.Info("cloud migration metrics already registered")
	}
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
