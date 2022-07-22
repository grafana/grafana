package plugins

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

func NewCfg() *Cfg {
	return &Cfg{}
}

func FromGrafanaCfg(grafanaCfg *setting.Cfg) *Cfg {
	cfg := &Cfg{}

	cfg.DevMode = grafanaCfg.Env == setting.Dev
	cfg.PluginsPath = grafanaCfg.PluginsPath

	cfg.PluginSettings = grafanaCfg.PluginSettings
	cfg.PluginsAllowUnsigned = grafanaCfg.PluginsAllowUnsigned
	cfg.EnterpriseLicensePath = grafanaCfg.EnterpriseLicensePath

	// AWS
	cfg.AWSAllowedAuthProviders = grafanaCfg.AWSAllowedAuthProviders
	cfg.AWSAssumeRoleEnabled = grafanaCfg.AWSAssumeRoleEnabled

	// Azure
	cfg.Azure = grafanaCfg.Azure

	cfg.BuildVersion = grafanaCfg.BuildVersion

	return cfg
}
