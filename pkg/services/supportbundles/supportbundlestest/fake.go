package supportbundlestest

import "github.com/grafana/grafana/pkg/services/supportbundles"

type FakeBundleService struct {
	Collectors []supportbundles.Collector
}

func NewFakeBundleService() *FakeBundleService {
	return &FakeBundleService{}
}

func (s *FakeBundleService) RegisterSupportItemCollector(collector supportbundles.Collector) {
	s.Collectors = append(s.Collectors, collector)
}
