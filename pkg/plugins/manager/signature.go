package manager

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("plugin.signature.validator")

type PluginSignatureValidator struct {
	cfg                           *setting.Cfg
	pluginClass                   plugins.PluginClass
	allowUnsignedPluginsCondition unsignedPluginV2ConditionFunc
}

type unsignedPluginV2ConditionFunc = func(plugin *plugins.PluginV2) bool

func newSignatureValidator(cfg *setting.Cfg, pluginClass plugins.PluginClass, unsignedCond unsignedPluginV2ConditionFunc) *PluginSignatureValidator {
	return &PluginSignatureValidator{
		cfg:                           cfg,
		pluginClass:                   pluginClass,
		allowUnsignedPluginsCondition: unsignedCond,
	}
}

func (s *PluginSignatureValidator) validate(plugin *plugins.PluginV2) error {
	if plugin.Signature == plugins.PluginSignatureValid {
		logger.Debug("Plugin has valid signature", "id", plugin.ID)
		return nil
	}

	if plugin.Parent != nil {
		// If a descendant plugin with invalid signature, set signature to that of root
		if plugin.IsCorePlugin() || plugin.Signature == plugins.PluginSignatureInternal {
			logger.Debug("Not setting descendant plugin's signature to that of root since it's core or internal",
				"plugin", plugin.ID, "signature", plugin.Signature, "isCore", plugin.IsCorePlugin)
		} else {
			logger.Debug("Setting descendant plugin's signature to that of root", "plugin", plugin.ID,
				"root", plugin.Parent.ID, "signature", plugin.Signature, "rootSignature", plugin.Parent.Signature)
			plugin.Signature = plugin.Parent.Signature
			plugin.SignatureType = plugin.Parent.SignatureType
			plugin.SignatureOrg = plugin.Parent.SignatureOrg
			if plugin.Signature == plugins.PluginSignatureValid {
				logger.Debug("Plugin has valid signature (inherited from root)", "id", plugin.ID)
				return nil
			}
		}
	} else {
		logger.Debug("Non-valid plugin Signature", "pluginID", plugin.ID, "pluginDir", plugin.PluginDir,
			"state", plugin.Signature)
	}

	if plugin.IsCorePlugin() || plugin.IsExternalPlugin() {
		return nil
	}

	switch plugin.Signature {
	case plugins.PluginSignatureUnsigned:
		if allowed := s.allowUnsigned(plugin); !allowed {
			logger.Debug("Plugin is unsigned", "pluginID", plugin.ID)
			return &plugins.PluginSignatureError{
				PluginID:        plugin.ID,
				SignatureStatus: plugins.PluginSignatureUnsigned,
			}
		}
		logger.Warn("Running an unsigned plugin", "pluginID", plugin.ID, "pluginDir", plugin.PluginDir)
		return nil
	case plugins.PluginSignatureInvalid:
		logger.Debug("Plugin has an invalid signature", "pluginID", plugin.ID)
		return &plugins.PluginSignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.PluginSignatureInvalid,
		}
	case plugins.PluginSignatureModified:
		logger.Debug("Plugin has a modified signature", "pluginID", plugin.ID)
		return &plugins.PluginSignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.PluginSignatureModified,
		}
	default:
		logger.Debug("Plugin has an unrecognized plugin signature state", "pluginID", plugin.ID, "signature",
			plugin.Signature)
		return &plugins.PluginSignatureError{
			PluginID: plugin.ID,
		}
	}
}

func (s *PluginSignatureValidator) allowUnsigned(plugin *plugins.PluginV2) bool {
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
