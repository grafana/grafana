package signature

import (
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

var logger = log.New("plugin.signature.validator")

type Validator struct {
	authorizer plugins.PluginLoaderAuthorizer
}

func NewValidator(authorizer plugins.PluginLoaderAuthorizer) Validator {
	return Validator{
		authorizer: authorizer,
	}
}

func (s *Validator) Validate(plugin *plugins.Plugin) *plugins.SignatureError {
	if plugin.Signature == plugins.SignatureValid {
		logger.Debug("Plugin has valid signature", "id", plugin.ID)
		return nil
	}

	// If a plugin is nested within another, create links to each other to inherit signature details
	if plugin.Parent != nil {
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
				return nil
			}
		}
	}

	if plugin.IsCorePlugin() || plugin.IsBundledPlugin() {
		return nil
	}

	switch plugin.Signature {
	case plugins.SignatureUnsigned:
		if authorized := s.authorizer.CanLoadPlugin(plugin); !authorized {
			logger.Debug("Plugin is unsigned", "pluginID", plugin.ID)
			return &plugins.SignatureError{
				PluginID:        plugin.ID,
				SignatureStatus: plugins.SignatureUnsigned,
			}
		}
		logger.Warn("Permitting unsigned plugin. This is not recommended", "pluginID", plugin.ID, "pluginDir", plugin.PluginDir)
		return nil
	case plugins.SignatureInvalid:
		logger.Debug("Plugin has an invalid signature", "pluginID", plugin.ID)
		return &plugins.SignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureInvalid,
		}
	case plugins.SignatureModified:
		logger.Debug("Plugin has a modified signature", "pluginID", plugin.ID)
		return &plugins.SignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureModified,
		}
	default:
		logger.Debug("Plugin has an unrecognized plugin signature state", "pluginID", plugin.ID, "signature",
			plugin.Signature)
		return &plugins.SignatureError{
			PluginID: plugin.ID,
		}
	}
}
