package validation

import (
	"context"
	"errors"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
)

// DefaultValidateFuncs are the default ValidateFunc used for the Validate step of the Validation stage.
func DefaultValidateFuncs(cfg *config.PluginManagementCfg) []ValidateFunc {
	return []ValidateFunc{
		SignatureValidationStep(signature.NewValidator(signature.NewUnsignedAuthorizer(cfg))),
		ModuleJSValidationStep(),
		AngularDetectionStep(cfg, angularinspector.NewStaticInspector()),
	}
}

type PluginSignatureValidator struct {
	signatureValidator signature.Validator
	log                log.Logger
}

func SignatureValidationStep(signatureValidator signature.Validator) ValidateFunc {
	return newPluginSignatureValidator(signatureValidator).Validate
}

func newPluginSignatureValidator(signatureValidator signature.Validator) *PluginSignatureValidator {
	return &PluginSignatureValidator{
		signatureValidator: signatureValidator,
		log:                log.New("plugins.validator.signature"),
	}
}

func (v *PluginSignatureValidator) Validate(_ context.Context, p *plugins.Plugin) error {
	return v.signatureValidator.ValidateSignature(p)
}

type ModuleJSValidator struct {
	log log.Logger
}

func ModuleJSValidationStep() ValidateFunc {
	return newModuleJSValidator().Validate
}

func newModuleJSValidator() *ModuleJSValidator {
	return &ModuleJSValidator{
		log: log.New("plugins.validator.module"),
	}
}

func (v *ModuleJSValidator) Validate(_ context.Context, p *plugins.Plugin) error {
	// CDN plugins are ignored because the module.js is guaranteed to exist
	if p.Class == plugins.ClassCDN {
		return nil
	}

	if !p.IsRenderer() && !p.IsCorePlugin() {
		f, err := p.FS.Open("module.js")
		if err != nil {
			if errors.Is(err, plugins.ErrFileNotExist) {
				v.log.Warn("Plugin missing module.js", "pluginId", p.ID,
					"warning", "Missing module.js, If you loaded this plugin from git, make sure to compile it.")
			}
		} else if f != nil {
			if err = f.Close(); err != nil {
				v.log.Warn("Could not close module.js", "pluginId", p.ID, "error", err)
			}
		}
	}
	return nil
}

type AngularDetector struct {
	cfg              *config.PluginManagementCfg
	angularInspector angularinspector.Inspector
	log              log.Logger
}

func AngularDetectionStep(cfg *config.PluginManagementCfg, angularInspector angularinspector.Inspector) ValidateFunc {
	return newAngularDetector(cfg, angularInspector).Validate
}

func newAngularDetector(cfg *config.PluginManagementCfg, angularInspector angularinspector.Inspector) *AngularDetector {
	return &AngularDetector{
		cfg:              cfg,
		angularInspector: angularInspector,
		log:              log.New("plugins.validator.angular"),
	}
}

func (a *AngularDetector) Validate(ctx context.Context, p *plugins.Plugin) error {
	if p.IsExternalPlugin() {
		var err error

		cctx, canc := context.WithTimeout(ctx, time.Second*10)
		p.Angular.Detected, err = a.angularInspector.Inspect(cctx, p)
		canc()

		if err != nil {
			a.log.Warn("Could not inspect plugin for angular", "pluginId", p.ID, "error", err)
		}

		// Do not initialize plugins if they're using Angular and Angular support is disabled
		if p.Angular.Detected {
			a.log.Error("Refusing to initialize plugin because it's using Angular, which has been disabled", "pluginId", p.ID)
			return (&plugins.Error{
				PluginID:  p.ID,
				ErrorCode: plugins.ErrorAngular,
			}).WithMessage("angular plugins are not supported")
		}
	}
	p.Angular.HideDeprecation = slices.Contains(a.cfg.HideAngularDeprecation, p.ID)
	return nil
}
