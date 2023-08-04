package validation

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Validator is responsible for the Validation stage of the plugin loader pipeline.
type Validator interface {
	Validate(ctx context.Context, p *plugins.Plugin) error
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
func (t *Validate) Validate(ctx context.Context, p *plugins.Plugin) error {
	for _, step := range t.validateSteps {
		if err := step(ctx, p); err != nil {
			return err
		}
	}

	return nil
}
