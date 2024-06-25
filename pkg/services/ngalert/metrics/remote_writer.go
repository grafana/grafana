package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type RemoteWriter struct {
	WritesTotal   *prometheus.CounterVec
	WriteDuration *prometheus.HistogramVec
}

func NewRemoteWriterMetrics(r prometheus.Registerer) *RemoteWriter {
	return &RemoteWriter{
		WritesTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_writer_writes_total",
			Help:      "The total number of remote writes attempted.",
		}, []string{"org", "backend", "status_code"}),
		WriteDuration: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "remote_writer_write_duration_seconds",
				Help:      "Histogram of remote write durations.",
				Buckets:   prometheus.DefBuckets,
			}, []string{"org", "backend"}),
	}
}
