package plugininstaller

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	features featuremgmt.FeatureToggles
	log      log.Logger
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) *Service {
	s := &Service{
		features: features,
		log:      log.New("plugin.installer"),
	}
	return s
}

// IsDisabled disables background installation of plugins.
func (s *Service) IsDisabled() bool {
	return !s.features.IsEnabled(context.Background(), featuremgmt.FlagBackgroundPluginInstaller)
}

func (s *Service) Run(ctx context.Context) error {
	s.log.Debug("PluginInstaller.Run not implemented")
	return nil
}
