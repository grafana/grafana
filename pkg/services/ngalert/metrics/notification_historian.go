package metrics

import (
	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type NotificationHistorian struct {
	Info          prometheus.Gauge
	WritesTotal   prometheus.Counter
	WritesFailed  prometheus.Counter
	WriteDuration *instrument.HistogramCollector
	BytesWritten  prometheus.Counter
}

func NewNotificationHistorianMetrics(r prometheus.Registerer) *NotificationHistorian {
	return &NotificationHistorian{
		Info: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "notification_history_info",
			Help:      "Information about the notification history store.",
		}),
		WritesTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "notification_history_writes_total",
			Help:      "The total number of notification history batches that were attempted to be written.",
		}),
		WritesFailed: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "notification_history_writes_failed_total",
			Help:      "The total number of failed writes of notification history batches.",
		}),
		WriteDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "notification_history_request_duration_seconds",
			Help:      "Histogram of request durations to the notification history store.",
			Buckets:   instrument.DefBuckets,
		}, instrument.HistogramCollectorBuckets)),
		BytesWritten: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "notification_history_writes_bytes_total",
			Help:      "The total number of bytes sent within a batch to the notification history store.",
		}),
	}
}
