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

// InitializeFunc is the function used for the Initialize step of the Initialization stage.
type InitializeFunc func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)

type Initialize struct {
	cfg             *config.PluginManagementCfg
	initializeSteps []InitializeFunc
	log             log.Logger
}

type Opts struct {
	InitializeFuncs []InitializeFunc
}

// New returns a new Initialization stage.
func New(cfg *config.PluginManagementCfg, opts Opts) *Initialize {
	if opts.InitializeFuncs == nil {
		opts.InitializeFuncs = []InitializeFunc{}
	}

	return &Initialize{
		cfg:             cfg,
		initializeSteps: opts.InitializeFuncs,
		log:             log.New("plugins.initialization"),
	}
}

// Initialize will execute the Initialize steps of the Initialization stage.
func (i *Initialize) Initialize(ctx context.Context, ps []*plugins.Plugin) ([]*plugins.Plugin, error) {
	if len(i.initializeSteps) == 0 {
		return ps, nil
	}

	var err error
	initializedPlugins := make([]*plugins.Plugin, 0, len(ps))
	for _, p := range ps {
		initializeSteps := i.initializeSteps
		if p.Status.Errored {
			// Plugin already failed in a previous stage, we only want to register it.
			initializeSteps = []InitializeFunc{}
			for _, init := range i.initializeSteps {
				if isRegistrationFunc(init) {
					initializeSteps = []InitializeFunc{init}
					break
				}
			}
			if len(initializeSteps) == 0 {
				return ps, nil
			}
		}
		var ip *plugins.Plugin
		stepFailed := false
		for _, init := range initializeSteps {
			ip, err = init(ctx, p)
			if err != nil {
				stepFailed = true
				i.log.Error("Could not initialize plugin", "pluginId", p.ID, "error", err)
				p.Status.Errored = true
				p.Status.Message = err.Error()
				initializedPlugins = append(initializedPlugins, p)
				break
			}
		}
		if !stepFailed {
			initializedPlugins = append(initializedPlugins, ip)
		}
	}

	return initializedPlugins, nil
}
