package termination

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Terminator is responsible for the Termination stage of the plugin loader pipeline.
type Terminator interface {
	Terminate(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)
}

// TerminateFunc is the function used for the Terminate step of the Termination stage.
type TerminateFunc func(ctx context.Context, p *plugins.Plugin) error

type Terminate struct {
	cfg            *config.PluginManagementCfg
	terminateSteps []TerminateFunc
	log            log.Logger
}

type Opts struct {
	TerminateFuncs []TerminateFunc
}

// New returns a new Termination stage.
func New(cfg *config.PluginManagementCfg, opts Opts) (*Terminate, error) {
	if opts.TerminateFuncs == nil {
		opts.TerminateFuncs = []TerminateFunc{}
	}

	return &Terminate{
		cfg:            cfg,
		terminateSteps: opts.TerminateFuncs,
		log:            log.New("plugins.termination"),
	}, nil
}

// Terminate will execute the Terminate steps of the Termination stage.
func (t *Terminate) Terminate(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	for _, terminate := range t.terminateSteps {
		if err := terminate(ctx, p); err != nil {
			return nil, err
		}
	}
	return p, nil
}
