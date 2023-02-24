package authnimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "authn"
	metricsNamespace = "grafana"
)

type metrics struct {
	failedLogin     *prometheus.CounterVec
	successfulLogin *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		failedLogin: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "authn_failed_login_total",
			Help:      "Number of failed logins",
		}, []string{"client"}),
		successfulLogin: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "authn_successful_login_total",
			Help:      "Number of successful logins",
		}, []string{"client"}),
	}

	if reg != nil {
		reg.MustRegister(m.failedLogin)
		reg.MustRegister(m.successfulLogin)
	}

	return m
}
