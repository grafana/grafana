package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
)

func ProvideOSSAuthorizer(cfg *config.PluginsCfg) *UnsignedPluginAuthorizer {
	return NewUnsignedAuthorizer(cfg)
}

func NewUnsignedAuthorizer(cfg *config.PluginsCfg) *UnsignedPluginAuthorizer {
	return &UnsignedPluginAuthorizer{
		cfg: cfg,
	}
}

type UnsignedPluginAuthorizer struct {
	cfg *config.PluginsCfg
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
