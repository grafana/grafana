package initialization

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Initializer is responsible for the Initialization stage of the plugin loader pipeline.
type Initializer interface {
	Initialize(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error)
}

type InitializeFunc func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)

type Initialize struct {
	cfg             *config.Cfg
	initializeSteps []InitializeFunc
	log             log.Logger
}

type Opts struct {
	InitializeFuncs []InitializeFunc
}

// New returns a new Initialization stage.
func New(cfg *config.Cfg, opts Opts) *Initialize {
	if len(opts.InitializeFuncs) == 0 {
		opts.InitializeFuncs = []InitializeFunc{}
	}

	return &Initialize{
		cfg:             cfg,
		initializeSteps: opts.InitializeFuncs,
		log:             log.New("plugins.initialization"),
	}
}

func (i *Initialize) Initialize(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error) {
	var err error

	initializedPlugins := make([]*plugins.Plugin, 0, len(ps))
	for _, p := range ps {
		for _, init := range i.initializeSteps {
			p, err = init(ctx, p)
			if err != nil {
				i.log.Error("Could not initialize plugin", "pluginId", p.ID, "err", err)
				continue
			}
			initializedPlugins = append(initializedPlugins, p)
		}
	}

	return initializedPlugins, nil
}
