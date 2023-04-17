package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Validator struct {
	authorizer plugins.PluginLoaderAuthorizer
	log        log.Logger
}

func NewValidator(authorizer plugins.PluginLoaderAuthorizer) Validator {
	return Validator{
		authorizer: authorizer,
		log:        log.New("plugin.signature.validator"),
	}
}

func (s *Validator) Validate(plugin *plugins.Plugin) *plugins.SignatureError {
	if plugin.Signature.IsValid() {
		s.log.Debug("Plugin has valid signature", "id", plugin.ID)
		return nil
	}

	// If a plugin is nested within another, create links to each other to inherit signature details
	if plugin.Parent != nil {
		if plugin.IsCorePlugin() || plugin.Signature.IsInternal() {
			s.log.Debug("Not setting descendant plugin's signature to that of root since it's core or internal",
				"plugin", plugin.ID, "signature", plugin.Signature, "isCore", plugin.IsCorePlugin())
		} else {
			s.log.Debug("Setting descendant plugin's signature to that of root", "plugin", plugin.ID,
				"root", plugin.Parent.ID, "signature", plugin.Signature, "rootSignature", plugin.Parent.Signature)
			plugin.Signature = plugin.Parent.Signature
			plugin.SignatureType = plugin.Parent.SignatureType
			plugin.SignatureOrg = plugin.Parent.SignatureOrg
			if plugin.Signature.IsValid() {
				s.log.Debug("Plugin has valid signature (inherited from root)", "id", plugin.ID)
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
			s.log.Debug("Plugin is unsigned", "pluginID", plugin.ID)
			return &plugins.SignatureError{
				PluginID:        plugin.ID,
				SignatureStatus: plugins.SignatureUnsigned,
			}
		}
		s.log.Warn("Permitting unsigned plugin. This is not recommended", "pluginID", plugin.ID)
		return nil
	case plugins.SignatureInvalid:
		s.log.Debug("Plugin has an invalid signature", "pluginID", plugin.ID)
		return &plugins.SignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureInvalid,
		}
	case plugins.SignatureModified:
		s.log.Debug("Plugin has a modified signature", "pluginID", plugin.ID)
		return &plugins.SignatureError{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureModified,
		}
	default:
		s.log.Debug("Plugin has an unrecognized plugin signature state", "pluginID", plugin.ID, "signature",
			plugin.Signature)
		return &plugins.SignatureError{
			PluginID: plugin.ID,
		}
	}
}
