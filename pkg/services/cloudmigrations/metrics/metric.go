package metrics

import (
	"errors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/client_golang/prometheus"
)

type Service struct {
	log log.Logger
}

func RegisterMetrics(
	prom prometheus.Registerer,
) (*Service, error) {
	s := &Service{
		log: log.New("cloudmigrations.metrics"),
	}

	if err := s.registerMetrics(prom); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Service) registerMetrics(prom prometheus.Registerer) error {
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
