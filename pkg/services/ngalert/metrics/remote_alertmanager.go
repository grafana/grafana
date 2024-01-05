package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/weaveworks/common/instrument"
)

type RemoteAlertmanager struct {
	HTTPRequestsDuration *instrument.HistogramCollector
}

func NewRemoteAlertmanagerMetrics(r prometheus.Registerer) *RemoteAlertmanager {
	return &RemoteAlertmanager{
		HTTPRequestsDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: Subsystem,
			Name:      "remote_alertmanager_http_request_duration_seconds",
			Help:      "Histogram of request durations to the remote Alertmanager.",
		}, instrument.HistogramCollectorBuckets)),
	}
}
