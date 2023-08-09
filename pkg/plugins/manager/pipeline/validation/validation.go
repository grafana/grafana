package validation

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Validator is responsible for the Validation stage of the plugin loader pipeline.
type Validator interface {
	Validate(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error)
}

// ValidateFunc is the function used for the Validate step of the Validation stage.
type ValidateFunc func(ctx context.Context, p *plugins.Plugin) error

type Validate struct {
	cfg           *config.Cfg
	validateSteps []ValidateFunc
	log           log.Logger
}

type Opts struct {
	ValidateFuncs []ValidateFunc
}

// New returns a new Validation stage.
func New(cfg *config.Cfg, opts Opts) *Validate {
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
func (t *Validate) Validate(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error) {
	if len(t.validateSteps) == 0 {
		return ps, nil
	}

	var err error
	verifiedPlugins := make([]*plugins.Plugin, 0, len(ps))
	for _, p := range ps {
		stepFailed := false
		for _, validate := range t.validateSteps {
			err = validate(ctx, p)
			if err != nil && !errors.Is(err, nil) {
				stepFailed = true
				t.log.Error("Plugin verification failed", "pluginID", p.ID, "err", err)
				break
			}
		}
		if !stepFailed {
			verifiedPlugins = append(verifiedPlugins, p)
		}
	}

	return verifiedPlugins, nil
}
