package signature

import (
	"github.com/grafana/grafana/pkg/infra/log"
)

type Validator struct {
	authorizer PluginLoaderAuthorizer
	log        log.Logger
}

func NewValidator(authorizer PluginLoaderAuthorizer) Validator {
	return Validator{
		authorizer: authorizer,
		log:        log.New("plugin.signature.validator"),
	}
}

type Args struct {
	PluginID        string
	SignatureStatus Status
	IsExternal      bool
}

func (s *Validator) Validate(args Args) *Error {
	if args.SignatureStatus == Valid {
		s.log.Debug("Plugin has valid signature", "id", args.PluginID)
		return nil
	}

	if !args.IsExternal {
		return nil
	}

	switch args.SignatureStatus {
	case Unsigned:
		if authorized := s.authorizer.CanLoadPlugin(PluginDetails{
			PluginID:        args.PluginID,
			SignatureStatus: args.SignatureStatus,
		}); !authorized {
			s.log.Debug("Plugin is unsigned", "pluginID", args.PluginID)
			return &Error{
				PluginID:        args.PluginID,
				SignatureStatus: Unsigned,
			}
		}
		s.log.Warn("Permitting unsigned plugin. This is not recommended", "pluginID", args.PluginID)
		return nil
	case Invalid:
		s.log.Debug("Plugin has an invalid signature", "pluginID", args.PluginID)
		return &Error{
			PluginID:        args.PluginID,
			SignatureStatus: Invalid,
		}
	case Modified:
		s.log.Debug("Plugin has a modified signature", "pluginID", args.PluginID)
		return &Error{
			PluginID:        args.PluginID,
			SignatureStatus: Modified,
		}
	default:
		s.log.Debug("Plugin has an unrecognized plugin signature state", "pluginID", args.PluginID,
			"signature", args.SignatureStatus)
		return &Error{
			PluginID: args.PluginID,
		}
	}
}
