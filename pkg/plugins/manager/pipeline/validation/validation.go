package validation

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Validator is responsible for the Validation stage of the plugin loader pipeline.
type Validator interface {
	Validate(ctx context.Context, ps *plugins.Plugin) error
}

// ValidateFunc is the function used for the Validate step of the Validation stage.
type ValidateFunc func(ctx context.Context, p *plugins.Plugin) error

type Validate struct {
	cfg           *config.PluginManagementCfg
	validateSteps []ValidateFunc
	log           log.Logger
}

type Opts struct {
	ValidateFuncs []ValidateFunc
}

// New returns a new Validation stage.
func New(cfg *config.PluginManagementCfg, opts Opts) *Validate {
	if opts.ValidateFuncs == nil {
		opts.ValidateFuncs = DefaultValidateFuncs(cfg)
	}

	return &Validate{
		cfg:           cfg,
		validateSteps: opts.ValidateFuncs,
		log:           log.New("plugins.validation"),
	}
}

// Validate will execute the Validate steps of the Validation stage.
func (v *Validate) Validate(ctx context.Context, ps *plugins.Plugin) error {
	if len(v.validateSteps) == 0 {
		return nil
	}
	errs := make(chan error, len(v.validateSteps))

	// If the PluginsCDNSyncLoaderEnabled feature is enabled, run all the validation steps in parallel.
	// Otherwise, run the validation steps sequentially.
	var limitSize int
	if v.cfg.Features.PluginsCDNSyncLoaderEnabled && ps.Class == plugins.ClassCDN {
		limitSize = min(len(v.validateSteps), v.cfg.LoaderConcurrencyLimit)
	} else {
		limitSize = 1
	}
	limit := make(chan struct{}, limitSize)
	for _, validate := range v.validateSteps {
		validate := validate
		limit <- struct{}{}
		go func() {
			errs <- validate(ctx, ps)
			<-limit
		}()
	}
	for i := 0; i < len(v.validateSteps); i++ {
		err := <-errs
		if err != nil {
			v.log.Error("Plugin validation failed", "pluginId", ps.ID, "error", err)
			return err
		}
	}
	close(errs)
	return nil
}
