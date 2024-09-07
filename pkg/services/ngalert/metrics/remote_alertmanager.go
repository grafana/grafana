package metrics

import (
	"github.com/grafana/dskit/instrument"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

const (
	ModeRemoteSecondary = "remote_secondary"
	ModeRemotePrimary   = "remote_primary"
	ModeRemoteOnly      = "remote_only"
)

type RemoteAlertmanager struct {
	ConfigSizeBytes       *prometheus.GaugeVec
	ConfigSyncErrorsTotal prometheus.Counter
	ConfigSyncsTotal      prometheus.Counter
	Info                  *prometheus.GaugeVec
	LastConfigSync        prometheus.Gauge
	LastReadinessCheck    prometheus.Gauge
	LastStateSync         prometheus.Gauge
	RequestLatency        *instrument.HistogramCollector
	StateSyncErrorsTotal  prometheus.Counter
	StateSyncsTotal       prometheus.Counter
}

func NewRemoteAlertmanagerMetrics(r prometheus.Registerer) *RemoteAlertmanager {
	return &RemoteAlertmanager{
		ConfigSizeBytes: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_config_size_bytes",
			Help:      "The size of the remote alertmanager configuration in bytes",
		}, []string{"org"}),
		ConfigSyncErrorsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_configuration_sync_failures_total",
			Help:      "Total number of failed attempts to sync configurations between Alertmanagers.",
		}),
		ConfigSyncsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_configuration_syncs_total",
			Help:      "Total number of configuration syncs to the remote Alertmanager.",
		}),
		Info: promauto.With(r).NewGaugeVec(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_info",
			Help:      "Information about the remote Alertmanager.",
		}, []string{"mode"}),
		LastConfigSync: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_last_configuration_sync_timestamp_seconds",
			Help:      "Timestamp of the last successful configuration sync to the remote Alertmanager in seconds.",
		}),
		LastReadinessCheck: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_last_readiness_check_timestamp_seconds",
			Help:      "Timestamp of the last successful readiness check to the remote Alertmanager in seconds.",
		}),
		LastStateSync: promauto.With(r).NewGauge(prometheus.GaugeOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_last_state_sync_timestamp_seconds",
			Help:      "Timestamp of the last successful state sync to the remote Alertmanager in seconds.",
		}),
		RequestLatency: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_latency_seconds",
			Help:      "Histogram of request latencies to the remote Alertmanager.",
		}, instrument.HistogramCollectorBuckets)),
		StateSyncErrorsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_state_sync_failures_total",
			Help:      "Total number of failed attempts to sync state between Alertmanagers.",
		}),
		StateSyncsTotal: promauto.With(r).NewCounter(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_state_syncs_total",
			Help:      "Total number of state syncs to the remote Alertmanager.",
		}),
	}
}
