package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type RemoteWriter struct {
	WritesTotal     *prometheus.CounterVec
	WriteDuration   *prometheus.HistogramVec
	WriteSizeBytes  *prometheus.HistogramVec
	BatchesPerWrite *prometheus.HistogramVec
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
		WriteSizeBytes: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "remote_writer_write_size_bytes",
				Help:      "Histogram of the estimated uncompressed size of each remote write request batch.",
				// ~1KB up to ~1GB so we can see requests approaching and exceeding the
				// typical 100MB distributor limit that motivated batching.
				Buckets: prometheus.ExponentialBuckets(1024, 4, 11),
			}, []string{"org", "backend"}),
		BatchesPerWrite: promauto.With(r).NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: Namespace,
				Subsystem: Subsystem,
				Name:      "remote_writer_batches_per_write",
				Help:      "Histogram of the number of request batches a single remote write was split into.",
				Buckets:   []float64{1, 2, 4, 8, 16, 32, 64},
			}, []string{"org", "backend"}),
	}
}
