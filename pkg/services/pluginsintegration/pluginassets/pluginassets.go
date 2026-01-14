package pluginassets

import (
	"context"

	"github.com/Masterminds/semver/v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/plugins/pluginassets/modulehash"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

const (
	CreatePluginVersionCfgKey               = "create_plugin_version"
	CreatePluginVersionScriptSupportEnabled = "4.15.0"
)

var (
	scriptLoadingMinSupportedVersion = semver.MustParse(CreatePluginVersionScriptSupportEnabled)
)

func ProvideService(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service,
	calc *modulehash.ModuleHashCalculator) *Service {
	return &Service{
		cfg:  cfg,
		cdn:  cdn,
		log:  log.New("pluginassets"),
		calc: calc,
	}
}

func ProvideModuleHashCalculator(cfg *config.PluginManagementCfg, cdn *pluginscdn.Service,
	signature *signature.Signature, reg registry.Service) *modulehash.ModuleHashCalculator {
	return modulehash.NewModuleHashCalculator(cfg, reg, cdn, signature)
}

type Service struct {
	cfg  *config.PluginManagementCfg
	cdn  *pluginscdn.Service
	calc *modulehash.ModuleHashCalculator

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
		if s.cdnEnabled(p.Parent.ID, p.FS) || p.Angular.Detected {
			return plugins.LoadingStrategyFetch
		}
	}

	if !s.cdnEnabled(p.ID, p.FS) && !p.Angular.Detected {
		return plugins.LoadingStrategyScript
	}

	return plugins.LoadingStrategyFetch
}

// ModuleHash returns the module.js SHA256 hash for a plugin in the format expected by the browser for SRI checks.
func (s *Service) ModuleHash(ctx context.Context, p pluginstore.Plugin) string {
	return s.calc.ModuleHash(ctx, p.ID, p.Info.Version)
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

func (s *Service) cdnEnabled(pluginID string, fs plugins.FS) bool {
	return s.cdn.PluginSupported(pluginID) || fs.Type().CDN()
}
