package config

import (
	"github.com/grafana/grafana/pkg/setting"
)

// PluginManagementCfg is the configuration for the plugin management system.
// It includes settings which are used to configure different components of plugin management.
type PluginManagementCfg struct {
	DevMode bool

	PluginsPath string

	PluginSettings       setting.PluginSettings
	PluginsAllowUnsigned []string
	DisablePlugins       []string
	ForwardHostEnvVars   []string

	PluginsCDNURLTemplate string

	GrafanaComURL string

	GrafanaAppURL string

	ExternalCorePluginsEnabled bool
	SkipHostEnvVarsEnabled     bool

	AngularSupportEnabled  bool
	HideAngularDeprecation []string
}

// NewPluginManagementCfg returns a new PluginManagementCfg.
func NewPluginManagementCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	pluginsCDNURLTemplate string, appURL string, externalCorePluginsEnabled, skipHostEnvVarsEnabled, angularSupportEnabled bool,
	grafanaComURL string, disablePlugins []string, hideAngularDeprecation []string, forwardHostEnvVars []string,
) *PluginManagementCfg {
	return &PluginManagementCfg{
		PluginsPath:                pluginsPath,
		DevMode:                    devMode,
		PluginSettings:             pluginSettings,
		PluginsAllowUnsigned:       pluginsAllowUnsigned,
		DisablePlugins:             disablePlugins,
		PluginsCDNURLTemplate:      pluginsCDNURLTemplate,
		GrafanaComURL:              grafanaComURL,
		GrafanaAppURL:              appURL,
		ExternalCorePluginsEnabled: externalCorePluginsEnabled,
		SkipHostEnvVarsEnabled:     skipHostEnvVarsEnabled,
		AngularSupportEnabled:      angularSupportEnabled,
		HideAngularDeprecation:     hideAngularDeprecation,
		ForwardHostEnvVars:         forwardHostEnvVars,
	}
}
