package authnimpl

import (
	"github.com/prometheus/client_golang/prometheus"
)

const (
	metricsSubSystem = "authn"
	metricsNamespace = "grafana"
)

type metrics struct {
	failedAuth     prometheus.Counter
	successfulAuth *prometheus.CounterVec

	failedLogin     *prometheus.CounterVec
	successfulLogin *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		failedAuth: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "authn_failed_authentication_total",
			Help:      "Number of failed authentications",
		}),
		successfulAuth: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "authn_successful_authentication_total",
			Help:      "Number of successful authentications",
		}, []string{"client"}),
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
		reg.MustRegister(
			m.failedAuth,
			m.successfulAuth,
			m.failedLogin,
			m.successfulLogin,
		)
	}

	return m
}
