package signature

import (
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/setting"
)

func UnsignedAuthorizer(cfg *config.Cfg) *UnsignedPluginAuthorizer {
	return &UnsignedPluginAuthorizer{
		cfg: cfg,
	}
}

func ProvideOSSAuthorizer(cfg *setting.Cfg) *UnsignedPluginAuthorizer {
	return UnsignedAuthorizer(config.FromGrafanaCfg(cfg))
}

type UnsignedPluginAuthorizer struct {
	cfg *config.Cfg
}

func (u *UnsignedPluginAuthorizer) CanLoadPlugin(pd PluginDetails) bool {
	if pd.SignatureStatus != Unsigned {
		return true
	}

	if u.cfg.DevMode {
		return true
	}

	for _, pID := range u.cfg.PluginsAllowUnsigned {
		if pID == pd.PluginID {
			return true
		}
	}

	return false
}
