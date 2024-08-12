package plugininstaller

import (
	"context"
	"errors"
	"runtime"
	"strings"

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

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, pluginStore pluginstore.Store, pluginInstaller plugins.Installer) *Service {
	s := &Service{
		features:        features,
		log:             log.New("background.plugin.installer"),
		cfg:             cfg,
		pluginInstaller: pluginInstaller,
		pluginStore:     pluginStore,
	}
	return s
}

// IsDisabled disables background installation of plugins.
func (s *Service) IsDisabled() bool {
	return !s.features.IsEnabled(context.Background(), featuremgmt.FlagBackgroundPluginInstaller) ||
		len(s.cfg.InstallPlugins) == 0
}

func (s *Service) Run(ctx context.Context) error {
	compatOpts := plugins.NewCompatOpts(s.cfg.BuildVersion, runtime.GOOS, runtime.GOARCH)

	for _, pluginIDRaw := range s.cfg.InstallPlugins {
		parsed := strings.Split(pluginIDRaw, "@")
		pluginID := parsed[0]
		version := ""
		if len(parsed) == 2 {
			version = parsed[1]
		}

		// Check if the plugin is already installed
		p, exists := s.pluginStore.Plugin(ctx, pluginID)
		if exists {
			// If it's installed, check if we are looking for a specific version
			if version == "" || p.Info.Version == version {
				s.log.Debug("Plugin already installed", "pluginID", pluginID, "version", version)
				continue
			}
		}

		s.log.Info("Installing plugin", "pluginID", pluginID, "version", version)
		err := s.pluginInstaller.Add(ctx, pluginID, version, compatOpts)
		if err != nil {
			var dupeErr plugins.DuplicateError
			if errors.As(err, &dupeErr) {
				s.log.Debug("Plugin already installed", "pluginID", pluginID, "version", version)
				continue
			}
			s.log.Error("Failed to install plugin", "pluginID", pluginID, "version", version, "err", err)
			continue
		}
		s.log.Info("Plugin successfully installed", "pluginID", pluginID, "version", version)
	}

	return nil
}
