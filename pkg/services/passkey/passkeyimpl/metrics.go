package passkeyimpl

import "github.com/prometheus/client_golang/prometheus"

const (
	metricsNamespace = "grafana"
	metricsSubSystem = "passkey"
)

const (
	resultSuccess = "success"
	resultFailure = "failure"
)

// metrics holds the passkey ceremony counters. Login/registration finishes are split by result so a
// dashboard can alert on failure rate; sign-count regressions get their own counter because a spike
// there signals a cloned authenticator, not ordinary user error.
type metrics struct {
	loginBegin           prometheus.Counter
	loginFinish          *prometheus.CounterVec
	registrationBegin    prometheus.Counter
	registrationFinish   *prometheus.CounterVec
	signCountRegressions prometheus.Counter
}

func newMetrics(reg prometheus.Registerer) *metrics {
	m := &metrics{
		loginBegin: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace, Subsystem: metricsSubSystem,
			Name: "login_begin_total", Help: "Number of passkey login ceremonies started",
		}),
		loginFinish: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Subsystem: metricsSubSystem,
			Name: "login_finish_total", Help: "Number of passkey login ceremonies finished by result",
		}, []string{"result"}),
		registrationBegin: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace, Subsystem: metricsSubSystem,
			Name: "registration_begin_total", Help: "Number of passkey registration ceremonies started",
		}),
		registrationFinish: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: metricsNamespace, Subsystem: metricsSubSystem,
			Name: "registration_finish_total", Help: "Number of passkey registration ceremonies finished by result",
		}, []string{"result"}),
		signCountRegressions: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace, Subsystem: metricsSubSystem,
			Name: "sign_count_regression_total", Help: "Number of rejected passkey logins due to a sign-count regression (possible cloned authenticator)",
		}),
	}

	if reg != nil {
		reg.MustRegister(m.loginBegin, m.loginFinish, m.registrationBegin, m.registrationFinish, m.signCountRegressions)
	}

	return m
}
