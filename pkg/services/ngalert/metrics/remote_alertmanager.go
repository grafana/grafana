package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/weaveworks/common/instrument"
)

type RemoteAlertmanager struct {
	HTTPRequestsTotal    *prometheus.CounterVec
	HTTPRequestsFailed   *prometheus.CounterVec
	HTTPRequestsDuration *instrument.HistogramCollector
}

func NewRemoteAlertmanagerMetrics(r prometheus.Registerer, subsystem string) *RemoteAlertmanager {
	return &RemoteAlertmanager{
		HTTPRequestsTotal: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "remote_alertmanager_http_requests_total",
			Help:      "Number of HTTP requests sent to the remote Alertmanager.",
		}, []string{"method", "path", "status_code"}),
		HTTPRequestsFailed: promauto.With(r).NewCounterVec(prometheus.CounterOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "remote_alertmanager_http_requests_failed",
			Help:      "Number of failed attempts to send an HTTP request to the remote Alertmanager.",
		}, []string{"method", "path"}),
		HTTPRequestsDuration: instrument.NewHistogramCollector(promauto.With(r).NewHistogramVec(prometheus.HistogramOpts{
			Namespace: Namespace,
			Subsystem: subsystem,
			Name:      "remote_alertmanager_http_request_duration_seconds",
			Help:      "Histogram of request durations to the remote Alertmanager.",
		}, instrument.HistogramCollectorBuckets)),
	}
}
