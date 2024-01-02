package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type RemoteSecondaryForkedAlertmanager struct {
	SyncsTotal                    *prometheus.CounterVec
	ConfigurationSyncsFailedTotal *prometheus.CounterVec
	StateSyncsFailedTotal         *prometheus.CounterVec
}

func NewRemoteSecondaryForkedAlertmanagerMetrics(r prometheus.Registerer, subsystem string) *RemoteSecondaryForkedAlertmanager {
	return &RemoteSecondaryForkedAlertmanager{
		SyncsTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "remote_secondary_forked_alertmanager_syncs_total",
			Help:      "The total number of configuration + state sync attempts between the internal and the remote Alertmanager.",
		}, []string{"org"}),
		ConfigurationSyncsFailedTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "remote_secondary_forked_alertmanager_configuration_syncs_failed_total",
			Help:      "The total number of failed attempts to sync configuration between Alertmanagers.",
		}, []string{"org"}),
		StateSyncsFailedTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "remote_secondary_forked_alertmanager_state_syncs_failed_total",
			Help:      "The total number of failed attempts to sync state between Alertmanagers.",
		}, []string{"org"}),
	}
}
