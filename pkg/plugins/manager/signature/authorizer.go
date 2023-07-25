package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

func ProvideOSSAuthorizer(cfg *config.Cfg) *UnsignedPluginAuthorizer {
	return NewUnsignedAuthorizer(cfg)
}

func NewUnsignedAuthorizer(cfg *config.Cfg) *UnsignedPluginAuthorizer {
	return &UnsignedPluginAuthorizer{
		cfg: cfg,
		log: log.New("plugin.signature.authorizer"),
	}
}

type UnsignedPluginAuthorizer struct {
	cfg *config.Cfg
	log log.Logger
}

func (u *UnsignedPluginAuthorizer) CanLoadPlugin(p *plugins.Plugin) bool {
	u.log.Info("Checking if plugin is allowed to be loaded", "pluginID", p.ID, "signature", p.Signature)
	if p.Signature != plugins.SignatureStatusUnsigned {
		u.log.Info("Permitting as signature is not unsigned", "pluginID", p.ID)
		return true
	}

	if u.cfg.DevMode {
		u.log.Info("Permitting as dev mode is enabled", "pluginID", p.ID)
		return true
	}

	for _, pID := range u.cfg.PluginsAllowUnsigned {
		if pID == p.ID {
			u.log.Info("Permitting as is in the allow list", "pluginID", p.ID)
			return true
		}
	}

	u.log.Info("Plugin is not permitted", "pluginID", p.ID)
	return false
}
