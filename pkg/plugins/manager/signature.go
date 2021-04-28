package manager

import (
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var logger = log.New("plugin.signature.validator")

type PluginSignatureValidator struct {
	cfg                           *setting.Cfg
	requireSigned                 bool
	errors                        []error
	allowUnsignedPluginsCondition unsignedPluginConditionFunc
}

func newSignatureValidator(cfg *setting.Cfg, requireSigned bool, unsignedCond unsignedPluginConditionFunc) *PluginSignatureValidator {
	return &PluginSignatureValidator{
		cfg:                           cfg,
		requireSigned:                 requireSigned,
		allowUnsignedPluginsCondition: unsignedCond,
	}
}

func (s *PluginSignatureValidator) validate(plugin *plugins.PluginBase) *plugins.PluginError {
	if plugin.Signature == plugins.PluginSignatureValid {
		logger.Debug("Plugin has valid signature", "id", plugin.Id)
		return nil
	}

	if plugin.Root != nil {
		// If a descendant plugin with invalid signature, set signature to that of root
		if plugin.IsCorePlugin || plugin.Signature == plugins.PluginSignatureInternal {
			logger.Debug("Not setting descendant plugin's signature to that of root since it's core or internal",
				"plugin", plugin.Id, "signature", plugin.Signature, "isCore", plugin.IsCorePlugin)
		} else {
			logger.Debug("Setting descendant plugin's signature to that of root", "plugin", plugin.Id,
				"root", plugin.Root.Id, "signature", plugin.Signature, "rootSignature", plugin.Root.Signature)
			plugin.Signature = plugin.Root.Signature
			if plugin.Signature == plugins.PluginSignatureValid {
				logger.Debug("Plugin has valid signature (inherited from root)", "id", plugin.Id)
				return nil
			}
		}
	} else {
		logger.Debug("Non-valid plugin Signature", "pluginID", plugin.Id, "pluginDir", plugin.PluginDir,
			"state", plugin.Signature)
	}

	// For the time being, we choose to only require back-end plugins to be signed
	// NOTE: the state is calculated again when setting metadata on the object
	if !plugin.Backend || !s.requireSigned {
		return nil
	}

	switch plugin.Signature {
	case plugins.PluginSignatureUnsigned:
		if allowed := s.allowUnsigned(plugin); !allowed {
			logger.Debug("Plugin is unsigned", "id", plugin.Id)
			s.errors = append(s.errors, fmt.Errorf("plugin %q is unsigned", plugin.Id))
			return &plugins.PluginError{
				ErrorCode: signatureMissing,
			}
		}
		logger.Warn("Running an unsigned backend plugin", "pluginID", plugin.Id, "pluginDir",
			plugin.PluginDir)
		return nil
	case plugins.PluginSignatureInvalid:
		logger.Debug("Plugin %q has an invalid signature", plugin.Id)
		s.errors = append(s.errors, fmt.Errorf("plugin %q has an invalid signature", plugin.Id))
		return &plugins.PluginError{
			ErrorCode: signatureInvalid,
		}
	case plugins.PluginSignatureModified:
		logger.Debug("Plugin %q has a modified signature", plugin.Id)
		s.errors = append(s.errors, fmt.Errorf("plugin %q's signature has been modified", plugin.Id))
		return &plugins.PluginError{
			ErrorCode: signatureModified,
		}
	default:
		panic(fmt.Sprintf("Plugin %q has unrecognized plugin signature state %q", plugin.Id, plugin.Signature))
	}
}

func (s *PluginSignatureValidator) allowUnsigned(plugin *plugins.PluginBase) bool {
	if s.allowUnsignedPluginsCondition != nil {
		return s.allowUnsignedPluginsCondition(plugin)
	}

	if s.cfg.Env == setting.Dev {
		return true
	}

	for _, plug := range s.cfg.PluginsAllowUnsigned {
		if plug == plugin.Id {
			return true
		}
	}

	return false
}
