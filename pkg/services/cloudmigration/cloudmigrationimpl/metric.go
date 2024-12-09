package cloudmigrationimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	namespace = "grafana"
	subsystem = "cloudmigrations"
)

type Metrics struct {
	accessTokenCreated *prometheus.CounterVec
	accessTokenDeleted *prometheus.CounterVec
}

func newMetrics() *Metrics {
	return &Metrics{
		accessTokenCreated: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "access_token_created",
			Help:      "Total of access tokens created",
		}, []string{"slug"}),
		accessTokenDeleted: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "access_token_deleted",
			Help:      "Total of access tokens deleted",
		}, []string{"slug"}),
	}
}

func (metrics *Metrics) Collect(ch chan<- prometheus.Metric) {
	metrics.accessTokenCreated.Collect(ch)
	metrics.accessTokenDeleted.Collect(ch)
}

func (metrics *Metrics) Describe(ch chan<- *prometheus.Desc) {
	metrics.accessTokenCreated.Describe(ch)
	metrics.accessTokenDeleted.Describe(ch)
}
