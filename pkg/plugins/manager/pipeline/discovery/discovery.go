package discovery

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Discoverer is responsible for the Discovery stage of the plugin loader pipeline.
type Discoverer interface {
	Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
}

// FindFunc is the function used for the Find step of the Discovery stage.
type FindFunc func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)

// FindFilterFunc is the function used for the Filter step of the Discovery stage.
type FindFilterFunc func(ctx context.Context, class plugins.Class, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

// Discovery implements the Discoverer interface.
//
// The Discovery stage is made up of the following steps (in order):
// - Find: Find plugins (from disk, remote, etc.)
// - Filter: Filter the results based on some criteria.
//
// The Find step is implemented by the FindFunc type.
//
// The Filter step is implemented by the FindFilterFunc type.
type Discovery struct {
	findStep        FindFunc
	findFilterSteps []FindFilterFunc
	log             log.Logger
}

type Opts struct {
	FindFunc        FindFunc
	FindFilterFuncs []FindFilterFunc
}

// New returns a new Discovery stage.
func New(cfg *config.PluginManagementCfg, opts Opts) *Discovery {
	if opts.FindFunc == nil {
		opts.FindFunc = DefaultFindFunc(cfg)
	}

	if opts.FindFilterFuncs == nil {
		opts.FindFilterFuncs = []FindFilterFunc{} // no filters by default
	}

	return &Discovery{
		findStep:        opts.FindFunc,
		findFilterSteps: opts.FindFilterFuncs,
		log:             log.New("plugins.discovery"),
	}
}

// Discover will execute the Find and Filter steps of the Discovery stage.
func (d *Discovery) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
	discoveredPlugins, err := d.findStep(ctx, src)
	if err != nil {
		return nil, err
	}

	for _, filter := range d.findFilterSteps {
		discoveredPlugins, err = filter(ctx, src.PluginClass(ctx), discoveredPlugins)
		if err != nil {
			return nil, err
		}
	}

	return discoveredPlugins, nil
}
