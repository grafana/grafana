package idimpl

import "github.com/prometheus/client_golang/prometheus"

const (
	metricsSubSystem = "authn"
	metricsNamespace = "grafana"
)

func newMetircus(reg prometheus.Registerer) *metrics {
	m := &metrics{
		singedTokens: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "idforwarding_signed_tokens_total",
			Help:      "Number of signed tokens",
		}),
		signedTokensFromCache: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: metricsNamespace,
			Subsystem: metricsSubSystem,
			Name:      "idforwarding_signed_tokens_from_cache_total",
			Help:      "Number of signed tokens retrieved from cahce",
		}),
	}

	if reg != nil {
		reg.MustRegister(m.singedTokens)
		reg.MustRegister(m.signedTokensFromCache)
	}

	return m
}

type metrics struct {
	singedTokens          prometheus.Counter
	signedTokensFromCache prometheus.Counter
}
