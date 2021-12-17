package plugins

import (
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
	Azure setting.AzureSettings

	CheckForUpdates bool

	BuildVersion string // TODO Remove
	AppSubURL    string // TODO Remove
}

func NewCfg() *Cfg {
	return &Cfg{}
}

func FromGrafanaCfg(grafanaCfg *setting.Cfg) *Cfg {
	cfg := &Cfg{}
	cfg.PluginsAllowUnsigned = grafanaCfg.PluginsAllowUnsigned
	cfg.EnterpriseLicensePath = grafanaCfg.EnterpriseLicensePath

	// AWS
	cfg.AWSAllowedAuthProviders = grafanaCfg.AWSAllowedAuthProviders
	cfg.AWSAssumeRoleEnabled = grafanaCfg.AWSAssumeRoleEnabled

	// Azure
	cfg.Azure = grafanaCfg.Azure

	cfg.CheckForUpdates = grafanaCfg.CheckForUpdates

	return cfg
}
