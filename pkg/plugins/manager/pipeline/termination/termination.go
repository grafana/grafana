package termination

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Terminator is responsible for the Termination stage of the plugin loader pipeline.
type Terminator interface {
	Terminate(ctx context.Context, pluginID string) error
}

// ResolveFunc is the function used for the Resolve step of the Termination stage.
type ResolveFunc func(ctx context.Context, pluginID string) (*plugins.Plugin, error)

// TerminateFunc is the function used for the Terminate step of the Termination stage.
type TerminateFunc func(ctx context.Context, p *plugins.Plugin) error

type Terminate struct {
	cfg            *config.Cfg
	resolveStep    ResolveFunc
	terminateSteps []TerminateFunc
	log            log.Logger
}

type Opts struct {
	ResolveFunc    ResolveFunc
	TerminateFuncs []TerminateFunc
}

// New returns a new Termination stage.
func New(cfg *config.Cfg, opts Opts) (*Terminate, error) {
	// without a resolve function, we can't do anything so return an error
	if opts.ResolveFunc == nil && opts.TerminateFuncs != nil {
		return nil, errors.New("resolve function is required")
	}

	if opts.TerminateFuncs == nil {
		opts.TerminateFuncs = []TerminateFunc{}
	}

	return &Terminate{
		cfg:            cfg,
		resolveStep:    opts.ResolveFunc,
		terminateSteps: opts.TerminateFuncs,
		log:            log.New("plugins.termination"),
	}, nil
}

// Terminate will execute the Terminate steps of the Termination stage.
func (t *Terminate) Terminate(ctx context.Context, pluginID string) error {
	p, err := t.resolveStep(ctx, pluginID)
	if err != nil {
		return err
	}

	for _, terminate := range t.terminateSteps {
		if err = terminate(ctx, p); err != nil {
			return err
		}
	}
	return nil
}
