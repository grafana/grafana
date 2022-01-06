package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg) (*UnsignedPluginAuthorizer, error) {
	return &UnsignedPluginAuthorizer{
		Cfg: plugins.FromGrafanaCfg(cfg),
	}, nil
}

type UnsignedPluginAuthorizer struct {
	Cfg *plugins.Cfg
}

func (u *UnsignedPluginAuthorizer) CanLoadPlugin(p *plugins.Plugin) bool {
	if p.Signature != plugins.SignatureUnsigned {
		return true
	}

	if u.Cfg.DevMode {
		return true
	}

	for _, pID := range u.Cfg.PluginsAllowUnsigned {
		if pID == p.ID {
			return true
		}
	}

	return false
}
