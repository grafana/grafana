package rest

import (
	"fmt"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type DualWriterMetrics struct {
	// DualWriterSyncerDuration is a metric summary for dual writer sync duration per mode
	syncer *prometheus.HistogramVec
	// DualWriterDataSyncerOutcome is a metric summary for dual writer data syncer outcome comparison between the 2 stores per mode
	syncerOutcome *prometheus.HistogramVec
}

func NewDualWriterMetrics(reg prometheus.Registerer) *DualWriterMetrics {
	return &DualWriterMetrics{
		syncer: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                        "dual_writer_data_syncer_duration_seconds",
			Help:                        "Histogram for the runtime of dual writer data syncer duration per mode",
			Namespace:                   "grafana",
			NativeHistogramBucketFactor: 1.1,
		}, []string{"is_error", "mode", "resource"}),

		syncerOutcome: promauto.With(reg).NewHistogramVec(prometheus.HistogramOpts{
			Name:                        "dual_writer_data_syncer_outcome",
			Help:                        "Histogram for the runtime of dual writer data syncer outcome comparison between the 2 stores per mode",
			Namespace:                   "grafana",
			NativeHistogramBucketFactor: 1.1,
		}, []string{"mode", "resource"}),
	}
}

func (m *DualWriterMetrics) recordDataSyncerDuration(isError bool, mode DualWriterMode, resource string, startFrom time.Time) {
	duration := time.Since(startFrom).Seconds()
	m.syncer.WithLabelValues(strconv.FormatBool(isError), fmt.Sprintf("%d", mode), resource).Observe(duration)
}

func (m *DualWriterMetrics) recordDataSyncerOutcome(mode DualWriterMode, resource string, synced bool) {
	var observeValue float64
	if !synced {
		observeValue = 1
	}
	m.syncerOutcome.WithLabelValues(fmt.Sprintf("%d", mode), resource).Observe(observeValue)
}
