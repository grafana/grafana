package config

import (
	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/setting"
)

type Cfg struct {
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
}

func ProvideConfig(grafanaCfg *setting.Cfg) *Cfg {
	return FromGrafanaCfg(grafanaCfg)
}

func FromGrafanaCfg(grafanaCfg *setting.Cfg) *Cfg {
	return &Cfg{
		DevMode:                 grafanaCfg.Env == setting.Dev,
		PluginsPath:             grafanaCfg.PluginsPath,
		PluginSettings:          grafanaCfg.PluginSettings,
		PluginsAllowUnsigned:    grafanaCfg.PluginsAllowUnsigned,
		EnterpriseLicensePath:   grafanaCfg.EnterpriseLicensePath,
		AWSAllowedAuthProviders: grafanaCfg.AWSAllowedAuthProviders,
		AWSAssumeRoleEnabled:    grafanaCfg.AWSAssumeRoleEnabled,
		Azure:                   grafanaCfg.Azure,
		BuildVersion:            grafanaCfg.BuildVersion,
	}
}
