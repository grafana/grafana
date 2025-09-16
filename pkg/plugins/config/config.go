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

	GrafanaComAPIURL   string
	GrafanaComAPIToken string

	GrafanaAppURL string

	Features Features
}

// Features contains the feature toggles used for the plugin management system.
type Features struct {
	SkipHostEnvVarsEnabled bool
	SriChecksEnabled       bool
	LocalizationForPlugins bool
	// Needed only until Tempo Alerting / metrics TraceQL is stable
	// https://github.com/grafana/grafana/issues/106888
	TempoAlertingEnabled bool
	PluginAssetProvider  bool
}

// NewPluginManagementCfg returns a new PluginManagementCfg.
func NewPluginManagementCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	pluginsCDNURLTemplate string, appURL string, features Features,
	grafanaComAPIURL string, disablePlugins []string, forwardHostEnvVars []string, grafanaComAPIToken string,
) *PluginManagementCfg {
	return &PluginManagementCfg{
		PluginsPath:           pluginsPath,
		DevMode:               devMode,
		PluginSettings:        pluginSettings,
		PluginsAllowUnsigned:  pluginsAllowUnsigned,
		DisablePlugins:        disablePlugins,
		PluginsCDNURLTemplate: pluginsCDNURLTemplate,
		GrafanaComAPIURL:      grafanaComAPIURL,
		GrafanaAppURL:         appURL,
		Features:              features,
		ForwardHostEnvVars:    forwardHostEnvVars,
		GrafanaComAPIToken:    grafanaComAPIToken,
	}
}
