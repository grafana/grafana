package cloudmigrationimpl

import (
	"errors"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/prometheus/client_golang/prometheus"
)

// type Metrics struct {
// 	log log.Logger
// }

func (s *Service) registerMetrics(prom prometheus.Registerer) error {
	for _, m := range cloudmigration.PromMetrics {
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
