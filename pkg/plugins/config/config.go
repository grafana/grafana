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

	HideAngularDeprecation []string
}

// Features contains the feature toggles used for the plugin management system.
type Features struct {
	ExternalCorePluginsEnabled  bool
	SkipHostEnvVarsEnabled      bool
	SriChecksEnabled            bool
	PluginsCDNSyncLoaderEnabled bool
	LocalizationForPlugins      bool
}

// NewPluginManagementCfg returns a new PluginManagementCfg.
func NewPluginManagementCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	pluginsCDNURLTemplate string, appURL string, features Features,
	grafanaComAPIURL string, disablePlugins []string, hideAngularDeprecation []string, forwardHostEnvVars []string, grafanaComAPIToken string,
) *PluginManagementCfg {
	return &PluginManagementCfg{
		PluginsPath:            pluginsPath,
		DevMode:                devMode,
		PluginSettings:         pluginSettings,
		PluginsAllowUnsigned:   pluginsAllowUnsigned,
		DisablePlugins:         disablePlugins,
		PluginsCDNURLTemplate:  pluginsCDNURLTemplate,
		GrafanaComAPIURL:       grafanaComAPIURL,
		GrafanaAppURL:          appURL,
		Features:               features,
		HideAngularDeprecation: hideAngularDeprecation,
		ForwardHostEnvVars:     forwardHostEnvVars,
		GrafanaComAPIToken:     grafanaComAPIToken,
	}
}
