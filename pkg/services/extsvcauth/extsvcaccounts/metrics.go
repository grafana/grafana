package extsvcaccounts

import "github.com/prometheus/client_golang/prometheus"

const namespace = "grafana"

type metrics struct {
	extSvcAccSavedCount prometheus.Counter
	extSvcAccDelCount   prometheus.Counter
}

func newMetrics(reg prometheus.Registerer) *metrics {
	var m metrics

	m.extSvcAccSavedCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Name:      "extsvc_saved_total",
		Help:      "Number of external service accounts saved since start up.",
	})
	m.extSvcAccDelCount = prometheus.NewCounter(prometheus.CounterOpts{
		Namespace: namespace,
		Name:      "extsvc_deleted_total",
		Help:      "Number of external service accounts deleted since start up.",
	})

	if reg != nil {
		reg.MustRegister(m.extSvcAccSavedCount)
	}

	return &m
}
