package signature

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("plugin.signature.validator")

type validator struct {
	cfg                           *setting.Cfg
	allowUnsignedPluginsCondition UnsignedPluginConditionFunc
}

type UnsignedPluginConditionFunc = func(plugin *plugins.PluginV2) bool

func NewValidator(cfg *setting.Cfg, unsignedCond UnsignedPluginConditionFunc) *validator {
	return &validator{
		cfg:                           cfg,
		allowUnsignedPluginsCondition: unsignedCond,
	}
}

func (s *validator) Validate(plugin *plugins.PluginV2) plugins.PluginSignatureError {
	if plugin.Signature == plugins.SignatureValid {
		logger.Debug("Plugin has valid signature", "id", plugin.ID)
		return plugins.PluginSignatureError{}
	}

	if plugin.Parent != nil {
		// If a descendant plugin with invalid signature, set signature to that of root
		if plugin.IsCorePlugin() || plugin.Signature == plugins.SignatureInternal {
			logger.Debug("Not setting descendant plugin's signature to that of root since it's core or internal",
				"plugin", plugin.ID, "signature", plugin.Signature, "isCore", plugin.IsCorePlugin)
		} else {
			logger.Debug("Setting descendant plugin's signature to that of root", "plugin", plugin.ID,
				"root", plugin.Parent.ID, "signature", plugin.Signature, "rootSignature", plugin.Parent.Signature)
			plugin.Signature = plugin.Parent.Signature
			plugin.SignatureType = plugin.Parent.SignatureType
			plugin.SignatureOrg = plugin.Parent.SignatureOrg
			if plugin.Signature == plugins.SignatureValid {
				logger.Debug("Plugin has valid signature (inherited from root)", "id", plugin.ID)
				return plugins.PluginSignatureError{}
			}
		}
	}

	if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
		return plugins.PluginSignatureError{}
	}

	switch plugin.Signature {
	case plugins.SignatureUnsigned:
		if allowed := s.allowUnsigned(plugin); !allowed {
			logger.Debug("Plugin is unsigned", "pluginID", plugin.ID)
			return plugins.PluginSignatureError{
				PluginID:        plugin.ID,
				SignatureStatus: plugins.SignatureUnsigned,
			}
		}
		logger.Warn("Running an unsigned plugin", "pluginID", plugin.ID, "pluginDir", plugin.PluginDir)
		return plugins.PluginSignatureError{}
	case plugins.SignatureInvalid:
		logger.Debug("Plugin has an invalid signature", "pluginID", plugin.ID)
		return plugins.PluginSignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureInvalid,
		}
	case plugins.SignatureModified:
		logger.Debug("Plugin has a modified signature", "pluginID", plugin.ID)
		return plugins.PluginSignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureModified,
		}
	default:
		logger.Debug("Plugin has an unrecognized plugin signature state", "pluginID", plugin.ID, "signature",
			plugin.Signature)
		return plugins.PluginSignatureError{
			PluginID: plugin.ID,
		}
	}
}

func (s *validator) allowUnsigned(plugin *plugins.PluginV2) bool {
	if s.allowUnsignedPluginsCondition != nil {
		return s.allowUnsignedPluginsCondition(plugin)
	}

	if s.cfg.Env == setting.Dev {
		return true
	}

	for _, plug := range s.cfg.PluginsAllowUnsigned {
		if plug == plugin.ID {
			return true
		}
	}

	return false
}
