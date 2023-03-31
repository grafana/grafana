package config

import (
	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/setting"
)

type Cfg struct {
	log log.Logger

	DevMode bool

	PluginsPath string

	PluginSettings       setting.PluginSettings
	PluginsAllowUnsigned []string

	// AWS Plugin Auth
	AWSAllowedAuthProviders []string
	AWSAssumeRoleEnabled    bool

	// Azure Cloud settings
	Azure *azsettings.AzureSettings

	BuildVersion string // TODO Remove

	LogDatasourceRequests bool

	PluginsCDNURLTemplate string

	OpenTelemetry OpenTelemetryCfg
}

func NewCfg(devMode bool, pluginsPath string, pluginSettings setting.PluginSettings, pluginsAllowUnsigned []string,
	awsAllowedAuthProviders []string, awsAssumeRoleEnabled bool, azure *azsettings.AzureSettings, grafanaVersion string,
	logDatasourceRequests bool, pluginsCDNURLTemplate string, openTelemetryCfg OpenTelemetryCfg) *Cfg {
	return &Cfg{
		log:                     log.New("plugin.cfg"),
		PluginsPath:             pluginsPath,
		BuildVersion:            grafanaVersion,
		DevMode:                 devMode,
		PluginSettings:          pluginSettings,
		PluginsAllowUnsigned:    pluginsAllowUnsigned,
		AWSAllowedAuthProviders: awsAllowedAuthProviders,
		AWSAssumeRoleEnabled:    awsAssumeRoleEnabled,
		Azure:                   azure,
		LogDatasourceRequests:   logDatasourceRequests,
		PluginsCDNURLTemplate:   pluginsCDNURLTemplate,
		OpenTelemetry:           openTelemetryCfg,
	}
}
