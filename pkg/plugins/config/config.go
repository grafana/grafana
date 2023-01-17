package config

import (
	"strings"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type Cfg struct {
	log log.Logger

	DevMode bool

	PluginsPath string

	PluginSettings       setting.PluginSettings
	PluginsAllowUnsigned []string

	EnterpriseLicensePath string

	// AWS Plugin Auth
	AWSAllowedAuthProviders []string
	AWSAssumeRoleEnabled    bool

	// Azure Cloud settings
	Azure *azsettings.AzureSettings

	BuildVersion string // TODO Remove

	LogDatasourceRequests bool

	PluginsCDNURLTemplate string
}

func ProvideConfig(settingProvider setting.Provider, grafanaCfg *setting.Cfg) *Cfg {
	return NewCfg(settingProvider, grafanaCfg)
}

func NewCfg(settingProvider setting.Provider, grafanaCfg *setting.Cfg) *Cfg {
	logger := log.New("plugin.cfg")

	aws := settingProvider.Section("aws")
	plugins := settingProvider.Section("plugins")

	allowedUnsigned := grafanaCfg.PluginsAllowUnsigned
	if len(plugins.KeyValue("allow_loading_unsigned_plugins").Value()) > 0 {
		allowedUnsigned = strings.Split(plugins.KeyValue("allow_loading_unsigned_plugins").Value(), ",")
	}

	allowedAuth := grafanaCfg.AWSAllowedAuthProviders
	if len(aws.KeyValue("allowed_auth_providers").Value()) > 0 {
		allowedUnsigned = strings.Split(settingProvider.KeyValue("plugins", "allow_loading_unsigned_plugins").Value(), ",")
	}

	return &Cfg{
		log:                     logger,
		PluginsPath:             grafanaCfg.PluginsPath,
		BuildVersion:            grafanaCfg.BuildVersion,
		DevMode:                 settingProvider.KeyValue("", "app_mode").MustBool(grafanaCfg.Env == setting.Dev),
		EnterpriseLicensePath:   settingProvider.KeyValue("enterprise", "license_path").MustString(grafanaCfg.EnterpriseLicensePath),
		PluginSettings:          extractPluginSettings(settingProvider),
		PluginsAllowUnsigned:    allowedUnsigned,
		AWSAllowedAuthProviders: allowedAuth,
		AWSAssumeRoleEnabled:    aws.KeyValue("assume_role_enabled").MustBool(grafanaCfg.AWSAssumeRoleEnabled),
		Azure:                   grafanaCfg.Azure,
		LogDatasourceRequests:   grafanaCfg.IsFeatureToggleEnabled(featuremgmt.FlagDatasourceLogger),
		PluginsCDNURLTemplate:   grafanaCfg.PluginsCDNURLTemplate,
	}
}

func extractPluginSettings(settingProvider setting.Provider) setting.PluginSettings {
	ps := setting.PluginSettings{}
	for sectionName, sectionCopy := range settingProvider.Current() {
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}
		// Calling Current() returns a redacted version of section. We need to replace the map values with the unredacted values.
		section := settingProvider.Section(sectionName)
		for k := range sectionCopy {
			sectionCopy[k] = section.KeyValue(k).MustString("")
		}
		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		ps[pluginID] = sectionCopy
	}

	return ps
}
