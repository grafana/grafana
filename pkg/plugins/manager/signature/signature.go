package signature

import (
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
)

type Validator interface {
	ValidateSignature(plugin *plugins.Plugin) error
}

type Validation struct {
	authorizer plugins.PluginLoaderAuthorizer
	log        log.Logger
}

func ProvideValidatorService(authorizer plugins.PluginLoaderAuthorizer) *Validation {
	return NewValidator(authorizer)
}

func NewValidator(authorizer plugins.PluginLoaderAuthorizer) *Validation {
	return &Validation{
		authorizer: authorizer,
		log:        log.New("plugin.signature.validator"),
	}
}

func (s *Validation) ValidateSignature(plugin *plugins.Plugin) error {
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

	if plugin.IsCorePlugin() {
		return nil
	}

	switch plugin.Signature {
	case plugins.SignatureStatusUnsigned:
		if authorized := s.authorizer.CanLoadPlugin(plugin); !authorized {
			s.log.Debug("Plugin is unsigned", "pluginId", plugin.ID)
			return &plugins.Error{
				PluginID:        plugin.ID,
				SignatureStatus: plugins.SignatureStatusUnsigned,
			}
		}
		s.log.Warn("Permitting unsigned plugin. This is not recommended", "pluginId", plugin.ID)
		return nil
	case plugins.SignatureStatusInvalid:
		s.log.Debug("Plugin has an invalid signature", "pluginId", plugin.ID)
		return &plugins.Error{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureStatusInvalid,
		}
	case plugins.SignatureStatusModified:
		s.log.Debug("Plugin has a modified signature", "pluginId", plugin.ID)
		return &plugins.Error{
			PluginID:        plugin.ID,
			SignatureStatus: plugins.SignatureStatusModified,
		}
	default:
		s.log.Debug("Plugin has an unrecognized plugin signature state", "pluginId", plugin.ID, "signature",
			plugin.Signature)
		return &plugins.Error{
			PluginID: plugin.ID,
		}
	}
}
