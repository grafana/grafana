package bundleregistry

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/supportbundles"
)

// Service is the service that registers support bundle collectors.
type Service struct {
	collectors map[string]supportbundles.Collector
	log        log.Logger
}

// NewService creates a new support bundle collector register service.
func ProvideService() *Service {
	return &Service{
		collectors: make(map[string]supportbundles.Collector),
		log:        log.New("support-bundle-collector-registry"),
	}
}

func (s *Service) RegisterSupportItemCollector(collector supportbundles.Collector) {
	if _, ok := s.collectors[collector.UID]; ok {
		s.log.Warn("Support bundle collector with the same UID already registered", "uid", collector.UID)
	}

	s.collectors[collector.UID] = collector
}

func (s *Service) Collectors() map[string]supportbundles.Collector {
	return s.collectors
}
