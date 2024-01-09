package metrics

import (
	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type RemoteAlertmanager struct {
	HTTPRequestDuration   *instrument.HistogramCollector
	LastReadinessCheck    prometheus.Gauge
	ConfigSyncsTotal      prometheus.Counter
	ConfigSyncErrorsTotal prometheus.Counter
	StateSyncsTotal       prometheus.Counter
	StateSyncErrorsTotal  prometheus.Counter
}

func NewRemoteAlertmanagerMetrics(r prometheus.Registerer) *RemoteAlertmanager {
	return &RemoteAlertmanager{
		HTTPRequestDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_latency_seconds",
			Help:      "Histogram of request durations to the remote Alertmanager.",
		}, instrument.HistogramCollectorBuckets)),
		LastReadinessCheck: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_last_readiness_check_timestamp_seconds",
			Help:      "Timestamp of the last successful readiness check to the remote Alertmanager in seconds.",
		}),
		ConfigSyncsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_configuration_syncs_total",
			Help:      "Total number of configuration syncs to the remote Alertmanager.",
		}),
		ConfigSyncErrorsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_configuration_sync_errors_total",
			Help:      "Total number of failed attempts to sync configurations between Alertmanagers.",
		}),
		StateSyncsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_state_syncs_total",
			Help:      "Total number of state syncs to the remote Alertmanager.",
		}),
		StateSyncErrorsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_state_sync_errors_total",
			Help:      "Total number of failed attempts to sync state between Alertmanagers.",
		}),
	}
}
