package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func NewUnsignedAuthorizer(cfg *plugins.Cfg) *UnsignedPluginAuthorizer {
	return &UnsignedPluginAuthorizer{
		cfg: cfg,
	}
}

func ProvideOSSAuthorizer(cfg *setting.Cfg) *UnsignedPluginAuthorizer {
	return NewUnsignedAuthorizer(plugins.FromGrafanaCfg(cfg))
}

type UnsignedPluginAuthorizer struct {
	cfg *plugins.Cfg
}

func (u *UnsignedPluginAuthorizer) CanLoadPlugin(p *plugins.Plugin) bool {
	if p.Signature != plugins.SignatureUnsigned {
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
