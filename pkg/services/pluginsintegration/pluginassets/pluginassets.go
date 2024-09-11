package pluginassets

import (
	"context"

	"github.com/Masterminds/semver/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	CreatePluginVersionCfgKey               = "create_plugin_version"
	CreatePluginVersionScriptSupportEnabled = "4.15.0"
)

var (
	scriptLoadingMinSupportedVersion = semver.MustParse(CreatePluginVersionScriptSupportEnabled)
)

func ProvideService(cfg *setting.Cfg, cdn *pluginscdn.Service) *Service {
	return &Service{
		cfg: cfg,
		cdn: cdn,
		log: log.New("pluginassets"),
	}
}

type Service struct {
	cfg *setting.Cfg
	cdn *pluginscdn.Service
	log log.Logger
}

// LoadingStrategy calculates the loading strategy for a plugin.
// If a plugin has plugin setting `create_plugin_version` >= 4.15.0, set loadingStrategy to "script".
// If a plugin is not loaded via the CDN and is not Angular, set loadingStrategy to "script".
// Otherwise, set loadingStrategy to "fetch".
func (s *Service) LoadingStrategy(_ context.Context, p pluginstore.Plugin) plugins.LoadingStrategy {
	if pCfg, ok := s.cfg.PluginSettings[p.ID]; ok {
		if s.compatibleCreatePluginVersion(pCfg) {
			return plugins.LoadingStrategyScript
		}
	}

	// If the plugin has a parent
	if p.Parent != nil {
		// Check the parent's create_plugin_version setting
		if pCfg, ok := s.cfg.PluginSettings[p.Parent.ID]; ok {
			if s.compatibleCreatePluginVersion(pCfg) {
				return plugins.LoadingStrategyScript
			}
		}

		// Since the parent plugin is not explicitly configured as script loading compatible,
		// If the plugin is either loaded from the CDN (via its parent) or contains Angular, we should use fetch
		if s.cdnEnabled(p.Parent.ID, p.Class) || p.Angular.Detected {
			return plugins.LoadingStrategyFetch
		}
	}

	if !s.cdnEnabled(p.ID, p.Class) && !p.Angular.Detected {
		return plugins.LoadingStrategyScript
	}

	return plugins.LoadingStrategyFetch
}

func (s *Service) compatibleCreatePluginVersion(ps map[string]string) bool {
	if cpv, ok := ps[CreatePluginVersionCfgKey]; ok {
		createPluginVer, err := semver.NewVersion(cpv)
		if err != nil {
			s.log.Warn("Failed to parse create plugin version setting as semver", "version", cpv, "error", err)
		} else {
			if !createPluginVer.LessThan(scriptLoadingMinSupportedVersion) {
				return true
			}
		}
	}
	return false
}

func (s *Service) cdnEnabled(pluginID string, class plugins.Class) bool {
	return s.cdn.PluginSupported(pluginID) || class == plugins.ClassCDN
}
