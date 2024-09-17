package supportbundlestest

import "github.com/grafana/grafana/pkg/services/supportbundles"

type FakeBundleService struct {
}

func NewFakeBundleService() *FakeBundleService {
	return &FakeBundleService{}
}

func (s *FakeBundleService) RegisterSupportItemCollector(collector supportbundles.Collector) {}
