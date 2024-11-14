package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
)

func ProvideOSSAuthorizer(cfg *config.PluginManagementCfg) *UnsignedPluginAuthorizer {
	return NewUnsignedAuthorizer(cfg)
}

func NewUnsignedAuthorizer(cfg *config.PluginManagementCfg) *UnsignedPluginAuthorizer {
	return &UnsignedPluginAuthorizer{
		cfg: cfg,
	}
}

type UnsignedPluginAuthorizer struct {
	cfg *config.PluginManagementCfg
}

func (u *UnsignedPluginAuthorizer) CanLoadPlugin(p *plugins.Plugin) bool {
	if p.Signature != plugins.SignatureStatusUnsigned {
		return true
	}

	if u.cfg.DevMode {
		return true
	}

	for _, pID := range u.cfg.PluginsAllowUnsigned {
		if pID == p.ID {
			return true
		}
	}

	return false
}
