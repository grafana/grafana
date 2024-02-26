package config

import (
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// PluginsCfg is the configuration for the plugin management system.
// It includes settings which are used to configure different components of plugin management.
type PluginsCfg struct {
	DevMode bool

	PluginsPath string

	PluginSettings       setting.PluginSettings
	PluginsAllowUnsigned []string
	DisablePlugins       []string
	ForwardHostEnvVars   []string

	PluginsCDNURLTemplate string

	Tracing Tracing

	GrafanaComURL string

	GrafanaAppURL    string
	GrafanaAppSubURL string

	Features featuremgmt.FeatureToggles

	AngularSupportEnabled  bool
	HideAngularDeprecation []string
}

// NewPluginsCfg returns a new PluginsCfg.
func NewPluginsCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	pluginsCDNURLTemplate string, appURL string, appSubURL string, tracing Tracing, features featuremgmt.FeatureToggles,
	angularSupportEnabled bool, grafanaComURL string, disablePlugins []string, hideAngularDeprecation []string,
	forwardHostEnvVars []string) *PluginsCfg {
	return &PluginsCfg{
		PluginsPath:            pluginsPath,
		DevMode:                devMode,
		PluginSettings:         pluginSettings,
		PluginsAllowUnsigned:   pluginsAllowUnsigned,
		DisablePlugins:         disablePlugins,
		PluginsCDNURLTemplate:  pluginsCDNURLTemplate,
		Tracing:                tracing,
		GrafanaComURL:          grafanaComURL,
		GrafanaAppURL:          appURL,
		GrafanaAppSubURL:       appSubURL,
		Features:               features,
		AngularSupportEnabled:  angularSupportEnabled,
		HideAngularDeprecation: hideAngularDeprecation,
		ForwardHostEnvVars:     forwardHostEnvVars,
	}
}
