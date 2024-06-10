package cloudmigrationimpl

import (
	"errors"
	"fmt"

	"github.com/prometheus/client_golang/prometheus"
)

// type Metrics struct {
const (
	namespace = "grafana"
	subsystem = "cloudmigrations"
)

var PromMetrics = []prometheus.Collector{
	prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: namespace,
		Subsystem: subsystem,
		Name:      "datasources_migrated",
		Help:      "Total amount of data sources migrated",
	}, []string{"pdc_converted"}),
}

type Metrics struct {
	accessTokenCreated *prometheus.CounterVec
}

func newMetrics() *Metrics {
	return &Metrics{
		accessTokenCreated: prometheus.NewCounterVec(prometheus.CounterOpts{
			Namespace: namespace,
			Subsystem: subsystem,
			Name:      "access_token_created",
			Help:      "Total of access tokens created",
		}, []string{"slug"}),
	}
}

func (s *Service) registerMetrics(prom prometheus.Registerer, metrics *Metrics) error {
	if err := prom.Register(metrics.accessTokenCreated); err != nil {
		var alreadyRegisterErr prometheus.AlreadyRegisteredError
		if errors.As(err, &alreadyRegisterErr) {
			s.log.Warn("metric already registered", "metric", metrics.accessTokenCreated)
		} else {
			return fmt.Errorf("registering access token created metric: %w", err)
		}
	}

	return nil
}
