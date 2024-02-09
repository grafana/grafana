package config

import (
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Cfg struct {
	log log.Logger

	DevMode bool

	PluginsPath string

	PluginSettings       setting.PluginSettings
	PluginsAllowUnsigned []string
	DisablePlugins       []string
	ForwardHostEnvVars   []string

	LogDatasourceRequests bool

	PluginsCDNURLTemplate string

	Tracing Tracing

	GrafanaComURL string

	GrafanaAppURL    string
	GrafanaAppSubURL string

	Features featuremgmt.FeatureToggles

	AngularSupportEnabled  bool
	HideAngularDeprecation []string
}

func NewCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	logDatasourceRequests bool, pluginsCDNURLTemplate string, appURL string, appSubURL string, tracing Tracing,
	features featuremgmt.FeatureToggles, angularSupportEnabled bool, grafanaComURL string, disablePlugins []string,
	hideAngularDeprecation []string, forwardHostEnvVars []string) *Cfg {
	return &Cfg{
		log:                    log.New("plugin.cfg"),
		PluginsPath:            pluginsPath,
		DevMode:                devMode,
		PluginSettings:         pluginSettings,
		PluginsAllowUnsigned:   pluginsAllowUnsigned,
		DisablePlugins:         disablePlugins,
		LogDatasourceRequests:  logDatasourceRequests,
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
