package pluginexternal

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg         *setting.Cfg
	logger      log.Logger
	pluginStore pluginstore.Store
}

func ProvideService(
	cfg *setting.Cfg, pluginStore pluginstore.Store,
) (*Service, error) {
	logger := log.New("datasources")
	s := &Service{
		cfg:         cfg,
		logger:      logger,
		pluginStore: pluginStore,
	}
	return s, nil
}

func (s *Service) Run(ctx context.Context) error {
	s.validateExternal()
	return ctx.Err()
}

func (s *Service) validateExternal() {
	for pluginID, pluginCfg := range s.cfg.PluginSettings {
		if pluginCfg["as_external"] == "true" {
			_, exists := s.pluginStore.Plugin(context.Background(), pluginID)
			if !exists {
				s.logger.Error("Core plugin expected to be loaded as external, but it is missing", "pluginID", pluginID)
			}
		}
	}
}
