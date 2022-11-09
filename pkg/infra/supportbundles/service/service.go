package service

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/supportbundles"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

type SupportBundleService struct {
	cfg     *setting.Cfg
	kvStore kvstore.KVStore

	log log.Logger

	collectors []supportbundles.CollectorFunc
}

const rootUrl = "/api/support-bundles"

func ProvideService(cfg *setting.Cfg, kvStore kvstore.KVStore, routeRegister routing.RouteRegister, tracer tracing.Tracer) *SupportBundleService {
	s := &SupportBundleService{
		cfg:     cfg,
		kvStore: kvStore,
		log:     log.New("supportbundle.service"),
	}

	s.registerAPIEndpoints(routeRegister)
	return s
}

func (s *SupportBundleService) RegisterSupportItemCollector(fn supportbundles.CollectorFunc) {
	s.collectors = append(s.collectors, fn)
}
