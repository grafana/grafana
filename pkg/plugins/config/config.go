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

	Features Features

	AngularSupportEnabled  bool
	HideAngularDeprecation []string

	StackID string
}

// IsCloud returns true if Grafana is running in Grafana Cloud.
func (c *PluginManagementCfg) IsCloud() bool {
	return c.StackID != ""
}

// Features contains the feature toggles used for the plugin management system.
type Features struct {
	ExternalCorePluginsEnabled bool
	SkipHostEnvVarsEnabled     bool
}

// NewPluginManagementCfg returns a new PluginManagementCfg.
func NewPluginManagementCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	pluginsCDNURLTemplate string, appURL string, features Features, angularSupportEnabled bool,
	grafanaComURL string, disablePlugins []string, hideAngularDeprecation []string, forwardHostEnvVars []string,
	stackID string,
) *PluginManagementCfg {
	return &PluginManagementCfg{
		PluginsPath:            pluginsPath,
		DevMode:                devMode,
		PluginSettings:         pluginSettings,
		PluginsAllowUnsigned:   pluginsAllowUnsigned,
		DisablePlugins:         disablePlugins,
		PluginsCDNURLTemplate:  pluginsCDNURLTemplate,
		GrafanaComURL:          grafanaComURL,
		GrafanaAppURL:          appURL,
		Features:               features,
		AngularSupportEnabled:  angularSupportEnabled,
		HideAngularDeprecation: hideAngularDeprecation,
		ForwardHostEnvVars:     forwardHostEnvVars,
		StackID:                stackID,
	}
}
