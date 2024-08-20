package plugininstaller

import (
	"context"
	"errors"
	"fmt"
	"runtime"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

type Service struct {
	cfg             *setting.Cfg
	features        featuremgmt.FeatureToggles
	log             log.Logger
	pluginInstaller plugins.Installer
	pluginStore     pluginstore.Store
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, pluginStore pluginstore.Store, pluginInstaller plugins.Installer) (*Service, error) {
	s := &Service{
		features:        features,
		log:             log.New("plugin.backgroundinstaller"),
		cfg:             cfg,
		pluginInstaller: pluginInstaller,
		pluginStore:     pluginStore,
	}
	if cfg.InstallPluginsBlock {
		// Block initialization process until plugins are installed
		err := s.installPlugins(context.Background(), true)
		if err != nil {
			return nil, err
		}
	}
	return s, nil
}

// IsDisabled disables background installation of plugins.
func (s *Service) IsDisabled() bool {
	return !s.features.IsEnabled(context.Background(), featuremgmt.FlagBackgroundPluginInstaller) ||
		len(s.cfg.InstallPlugins) == 0 ||
		s.cfg.InstallPluginsBlock
}

func (s *Service) installPlugins(ctx context.Context, block bool) error {
	compatOpts := plugins.NewCompatOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)

	for _, installPlugin := range s.cfg.InstallPlugins {
		// Check if the plugin is already installed
		p, exists := s.pluginStore.Plugin(ctx, installPlugin.ID)
		if exists {
			// If it's installed, check if we are looking for a specific version
			if installPlugin.Version == "" || p.Info.Version == installPlugin.Version {
				s.log.Debug("Plugin already installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
				continue
			}
		}

		s.log.Info("Installing plugin", "pluginId", installPlugin.ID, "version", installPlugin.Version)
		err := s.pluginInstaller.Add(ctx, installPlugin.ID, installPlugin.Version, compatOpts)
		if err != nil {
			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				s.log.Debug("Plugin already installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
				continue
			}
			if block {
				return fmt.Errorf("failed to install plugin %s@%s: %w", installPlugin.ID, installPlugin.Version, err)
			}
			s.log.Error("Failed to install plugin", "pluginId", installPlugin.ID, "version", installPlugin.Version, "error", err)
			continue
		}
		s.log.Info("Plugin successfully installed", "pluginId", installPlugin.ID, "version", installPlugin.Version)
	}

	return nil
}

func (s *Service) Run(ctx context.Context) error {
	return s.installPlugins(ctx, false)
}
