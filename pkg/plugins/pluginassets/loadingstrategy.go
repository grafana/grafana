package pluginassets

import (
	"github.com/Masterminds/semver/v3"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
)

const (
	CreatePluginVersionCfgKey               = "create_plugin_version"
	CreatePluginVersionScriptSupportEnabled = "4.15.0"
)

var (
	scriptLoadingMinSupportedVersion = semver.MustParse(CreatePluginVersionScriptSupportEnabled)
)

// CalculateLoadingStrategy calculates the loading strategy for a plugin.
// If a plugin has plugin setting `create_plugin_version` >= 4.15.0, set loadingStrategy to "script".
// If a plugin is not loaded via the CDN and is not Angular, set loadingStrategy to "script".
// Otherwise, set loadingStrategy to "fetch".
func CalculateLoadingStrategy(p *plugins.Plugin, cfg *config.PluginManagementCfg, cdn *pluginscdn.Service) plugins.LoadingStrategy {
	if cfg != nil && cfg.PluginSettings != nil {
		if pCfg, ok := cfg.PluginSettings[p.ID]; ok {
			if compatibleCreatePluginVersion(pCfg) {
				return plugins.LoadingStrategyScript
			}
		}

		// If the plugin has a parent
		if p.Parent != nil {
			// Check the parent's create_plugin_version setting
			if pCfg, ok := cfg.PluginSettings[p.Parent.ID]; ok {
				if compatibleCreatePluginVersion(pCfg) {
					return plugins.LoadingStrategyScript
				}
			}

			// Since the parent plugin is not explicitly configured as script loading compatible,
			// If the plugin is either loaded from the CDN (via its parent) or contains Angular, we should use fetch
			if cdnEnabled(p.Parent, cdn) || p.Angular.Detected {
				return plugins.LoadingStrategyFetch
			}
		}
	}

	if !cdnEnabled(p, cdn) && !p.Angular.Detected {
		return plugins.LoadingStrategyScript
	}

	return plugins.LoadingStrategyFetch
}

// compatibleCreatePluginVersion checks if the create_plugin_version setting is >= 4.15.0
func compatibleCreatePluginVersion(ps map[string]string) bool {
	if cpv, ok := ps[CreatePluginVersionCfgKey]; ok {
		createPluginVer, err := semver.NewVersion(cpv)
		if err != nil {
			// Invalid semver, treat as incompatible
			return false
		}
		return !createPluginVer.LessThan(scriptLoadingMinSupportedVersion)
	}
	return false
}

func cdnEnabled(p *plugins.Plugin, cdn *pluginscdn.Service) bool {
	return cdn.PluginSupported(p.ID) || p.FS.Type().CDN()
}
