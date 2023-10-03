package pipeline

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
)

// ExternalServiceRegistration implements an InitializeFunc for registering external services.
type ExternalServiceRegistration struct {
	cfg                     *config.Cfg
	externalServiceRegistry auth.ExternalServiceRegistry
	log                     log.Logger
}

// ExternalServiceRegistrationStep returns an InitializeFunc for registering external services.
func ExternalServiceRegistrationStep(cfg *config.Cfg, externalServiceRegistry auth.ExternalServiceRegistry) initialization.InitializeFunc {
	return newExternalServiceRegistration(cfg, externalServiceRegistry).Register
}

func newExternalServiceRegistration(cfg *config.Cfg, serviceRegistry auth.ExternalServiceRegistry) *ExternalServiceRegistration {
	return &ExternalServiceRegistration{
		cfg:                     cfg,
		externalServiceRegistry: serviceRegistry,
		log:                     log.New("plugins.external.registration"),
	}
}

// Register registers the external service with the external service registry, if the feature is enabled.
func (r *ExternalServiceRegistration) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if p.ExternalServiceRegistration != nil && r.cfg.Features.IsEnabled(featuremgmt.FlagExternalServiceAuth) {
		s, err := r.externalServiceRegistry.RegisterExternalService(ctx, p.ID, p.ExternalServiceRegistration)
		if err != nil {
			r.log.Error("Could not register an external service. Initialization skipped", "pluginId", p.ID, "error", err)
			return nil, err
		}
		p.ExternalService = s
	}
	return p, nil
}

// RegisterPluginRoles implements an InitializeFunc for registering plugin roles.
type RegisterPluginRoles struct {
	log          log.Logger
	roleRegistry plugins.RoleRegistry
}

// RegisterPluginRolesStep returns a new InitializeFunc for registering plugin roles.
func RegisterPluginRolesStep(roleRegistry plugins.RoleRegistry) initialization.InitializeFunc {
	return newRegisterPluginRoles(roleRegistry).Register
}

func newRegisterPluginRoles(registry plugins.RoleRegistry) *RegisterPluginRoles {
	return &RegisterPluginRoles{
		log:          log.New("plugins.roles.registration"),
		roleRegistry: registry,
	}
}

// Register registers the plugin roles with the role registry.
func (r *RegisterPluginRoles) Register(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if err := r.roleRegistry.DeclarePluginRoles(ctx, p.ID, p.Name, p.Roles); err != nil {
		r.log.Warn("Declare plugin roles failed.", "pluginId", p.ID, "error", err)
	}
	return p, nil
}

// ReportBuildMetrics reports build information for all plugins, except core and bundled plugins.
func ReportBuildMetrics(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	if !p.IsCorePlugin() && !p.IsBundledPlugin() {
		metrics.SetPluginBuildInformation(p.ID, string(p.Type), p.Info.Version, string(p.Signature))
	}
	return p, nil
}

// SignatureValidation implements a ValidateFunc for validating plugin signatures.
type SignatureValidation struct {
	signatureValidator signature.Validator
	errs               pluginerrs.SignatureErrorTracker
	log                log.Logger
}

// SignatureValidationStep returns a new ValidateFunc for validating plugin signatures.
func SignatureValidationStep(signatureValidator signature.Validator,
	sigErr pluginerrs.SignatureErrorTracker) validation.ValidateFunc {
	sv := &SignatureValidation{
		errs:               sigErr,
		signatureValidator: signatureValidator,
		log:                log.New("plugins.signature.validation"),
	}
	return sv.Validate
}

// Validate validates the plugin signature. If a signature error is encountered, the error is recorded with the
// pluginerrs.SignatureErrorTracker.
func (v *SignatureValidation) Validate(ctx context.Context, p *plugins.Plugin) error {
	err := v.signatureValidator.ValidateSignature(p)
	if err != nil {
		var sigErr *plugins.SignatureError
		if errors.As(err, &sigErr) {
			v.log.Warn("Skipping loading plugin due to problem with signature",
				"pluginId", p.ID, "status", sigErr.SignatureStatus)
			p.SignatureError = sigErr
			v.errs.Record(ctx, sigErr)
		}
		return err
	}

	// clear plugin error if a pre-existing error has since been resolved
	v.errs.Clear(ctx, p.ID)

	return nil
}

// DisablePlugins is a filter step that will filter out any configured plugins
type DisablePlugins struct {
	log log.Logger
	cfg *config.Cfg
}

// NewDisablePluginsStep returns a new DisablePlugins.
func NewDisablePluginsStep(cfg *config.Cfg) *DisablePlugins {
	return &DisablePlugins{
		cfg: cfg,
		log: log.New("plugins.disable"),
	}
}

// Filter will filter out any plugins that are marked to be disabled.
func (c *DisablePlugins) Filter(bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	if len(c.cfg.DisablePlugins) == 0 {
		return bundles, nil
	}

	disablePluginsMap := make(map[string]bool)
	for _, pluginID := range c.cfg.DisablePlugins {
		disablePluginsMap[pluginID] = true
	}

	res := []*plugins.FoundBundle{}
	for _, bundle := range bundles {
		if disablePluginsMap[bundle.Primary.JSONData.ID] {
			c.log.Debug("Disabling plugin load", "pluginID", bundle.Primary.JSONData.ID)
		} else {
			res = append(res, bundle)
		}
	}
	return res, nil
}

// AsExternal is a filter step that will skip loading a core plugin to use an external one.
type AsExternal struct {
	log log.Logger
	cfg *config.Cfg
}

// NewDisablePluginsStep returns a new DisablePlugins.
func NewAsExternalStep(cfg *config.Cfg) *AsExternal {
	return &AsExternal{
		cfg: cfg,
		log: log.New("plugins.asExternal"),
	}
}

// Filter will filter out any plugins that are marked to be disabled.
func (c *AsExternal) Filter(cl plugins.Class, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	if c.cfg.Features == nil || !c.cfg.Features.IsEnabled(featuremgmt.FlagExternalCorePlugins) {
		return bundles, nil
	}

	if cl == plugins.ClassCore {
		res := []*plugins.FoundBundle{}
		for _, bundle := range bundles {
			pluginCfg := c.cfg.PluginSettings[bundle.Primary.JSONData.ID]
			// Skip core plugins if the feature flag is enabled and the plugin is in the skip list.
			// It could be loaded later as an external plugin.
			if pluginCfg["as_external"] == "true" {
				c.log.Debug("Skipping the core plugin load", "pluginID", bundle.Primary.JSONData.ID)
			} else {
				res = append(res, bundle)
			}
		}
		return res, nil
	}

	if cl == plugins.ClassExternal {
		// Warn if the plugin is not found in the external plugins directory.
		asExternal := map[string]bool{}
		for pluginID, pluginCfg := range c.cfg.PluginSettings {
			if pluginCfg["as_external"] == "true" {
				asExternal[pluginID] = true
			}
		}
		for _, bundle := range bundles {
			if asExternal[bundle.Primary.JSONData.ID] {
				delete(asExternal, bundle.Primary.JSONData.ID)
			}
		}
		if len(asExternal) > 0 {
			for p := range asExternal {
				c.log.Error("Core plugin expected to be loaded as external, but it is missing", "pluginID", p)
			}
		}
	}

	return bundles, nil
}
