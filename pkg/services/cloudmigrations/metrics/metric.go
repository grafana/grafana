package metrics

import (
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

type Metrics struct {
	log log.Logger
}

func RegisterMetrics(
	prom prometheus.Registerer,
) (*Metrics, error) {
	s := &Metrics{
		log: log.New("cloudmigrations.metrics"),
	}

	if err := s.registerMetrics(prom); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Metrics) registerMetrics(prom prometheus.Registerer) error {
	for _, m := range promMetrics {
		if err := prom.Register(m); err != nil {
			var alreadyRegisterErr prometheus.AlreadyRegisteredError
			if errors.As(err, &alreadyRegisterErr) {
				s.log.Warn("metric already registered", "metric", m)
				continue
			}
			return err
		}
	}
	return nil
}
