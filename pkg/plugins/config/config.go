package config

import (
	"strconv"
	"strings"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type Cfg struct {
	log log.Logger

	DevMode bool

	PluginSettings       PluginSettings
	PluginsAllowUnsigned []string

	EnterpriseLicensePath string

	// AWS Plugin Auth
	AWSAllowedAuthProviders []string
	AWSAssumeRoleEnabled    bool

	// Azure Cloud settings
	Azure *azsettings.AzureSettings

	BuildVersion string // TODO Remove
}

// PluginSettings maps plugin id to map of key/value settings.
type PluginSettings map[string]map[string]string

func ProvideConfig(settingProvider setting.Provider, grafanaCfg *setting.Cfg) *Cfg {
	return NewCfg(settingProvider, grafanaCfg.BuildVersion)
}

func NewCfg(settingProvider setting.Provider, buildVersion string) *Cfg {
	logger := log.New("plugin.cfg")

	azure := settingProvider.Section("azure")
	managedIdentityEnabled, err := strconv.ParseBool(azure.KeyValue("managed_identity_enabled").Value())
	if err != nil {
		logger.Warn("Could not parse plugin config 'managed_identity_enabled'", "err", err)
		managedIdentityEnabled = false
	}

	aws := settingProvider.Section("aws")
	assumeRoleEnabled, err := strconv.ParseBool(aws.KeyValue("assume_role_enabled").Value())
	if err != nil {
		logger.Warn("Could not parse plugin config 'assume_role_enabled'", "err", err)
		assumeRoleEnabled = false
	}

	// TODO confirm if we should specify default values
	return &Cfg{
		log:                     logger,
		DevMode:                 settingProvider.KeyValue("", "app_mode").Value() == setting.Dev,
		PluginSettings:          extractPluginSettings(settingProvider),
		PluginsAllowUnsigned:    strings.Split(settingProvider.KeyValue("plugins", "allow_loading_unsigned_plugins").Value(), ","),
		EnterpriseLicensePath:   settingProvider.KeyValue("enterprise", "license_path").Value(),
		AWSAllowedAuthProviders: strings.Split(aws.KeyValue("allowed_auth_providers").Value(), ","),
		AWSAssumeRoleEnabled:    assumeRoleEnabled,
		Azure: &azsettings.AzureSettings{
			Cloud:                   azure.KeyValue("cloud").Value(),
			ManagedIdentityEnabled:  managedIdentityEnabled,
			ManagedIdentityClientId: azure.KeyValue("managed_identity_client_id").Value(),
		},
		BuildVersion: buildVersion,
	}
}

func extractPluginSettings(settingProvider setting.Provider) PluginSettings {
	ps := PluginSettings{}
	for sectionName, section := range settingProvider.Current() {
		if !strings.HasPrefix(sectionName, "plugin.") {
			continue
		}

		pluginID := strings.Replace(sectionName, "plugin.", "", 1)
		ps[pluginID] = section
	}

	return ps
}
