package client

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type k8sClientMetrics struct {
	fallbackCounter *prometheus.CounterVec
}

func newK8sClientMetrics(reg prometheus.Registerer) *k8sClientMetrics {
	return &k8sClientMetrics{
		fallbackCounter: promauto.With(reg).NewCounterVec(prometheus.CounterOpts{
			Namespace: "grafana",
			Name:      "dashboard_stored_version_fallback_total",
			Help:      "Number of K8s dashboard client requests to storedVersion",
		}, []string{"stored_version"}),
	}
}
