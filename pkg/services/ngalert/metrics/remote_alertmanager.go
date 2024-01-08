package metrics

import (
	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type RemoteAlertmanager struct {
	HTTPRequestDuration *instrument.HistogramCollector
	LastReadinessCheck  prometheus.Gauge
}

func NewRemoteAlertmanagerMetrics(r prometheus.Registerer) *RemoteAlertmanager {
	return &RemoteAlertmanager{
		HTTPRequestDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_http_request_duration_seconds",
			Help:      "Histogram of request durations to the remote Alertmanager.",
		}, instrument.HistogramCollectorBuckets)),
		LastReadinessCheck: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_last_readiness_check_timestamp_seconds",
			Help:      "Timestamp of the last readiness check to the remote Alertmanager in seconds.",
		}),
	}
}
