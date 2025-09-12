package extsvcaccounts

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/prometheus/client_golang/prometheus"
)

type metrics struct {
	storedCount  prometheus.GaugeFunc
	savedCount   prometheus.Counter
	deletedCount prometheus.Counter
}

func newMetrics(reg prometheus.Registerer, defaultOrgID int64, saSvc serviceaccounts.Service, logger log.Logger) *metrics {
	var m metrics

	m.savedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Name:      "extsvc_saved_total",
		Help:      "Number of external service accounts saved since start up.",
	})
	m.deletedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: metricsNamespace,
		Name:      "extsvc_deleted_total",
		Help:      "Number of external service accounts deleted since start up.",
	})

	if reg != nil {
		reg.MustRegister(m.savedCount)
		reg.MustRegister(m.deletedCount)
	}

	return &m
}
