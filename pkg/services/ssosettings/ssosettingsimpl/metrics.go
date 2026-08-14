package ssosettingsimpl

import "github.com/prometheus/client_golang/prometheus"

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "ssosettings"
)

type metrics struct {
	reloadFailures *prometheus.CounterVec
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		reloadFailures: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "setting_reload_failures_total",
			Help:      "Number of SSO Setting reload failures.",
		}, []string{"provider"}),
	}

	if reg != nil {
		reg.MustRegister(
			m.reloadFailures,
		)
	}

	return m
}
