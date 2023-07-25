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
type FindFilterFunc func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

// Discovery implements the Discoverer interface.
type Discovery struct {
	findStep       FindFunc
	findFilterStep FindFilterFunc
	log            log.Logger
}

type Opts struct {
	FindFunc       FindFunc
	FindFilterFunc FindFilterFunc
}

// New returns a new Discovery stage.
func New(cfg *config.Cfg, opts Opts) *Discovery {
	if opts.FindFunc == nil {
		opts.FindFunc = DefaultFindFunc(cfg)
	}

	if opts.FindFilterFunc == nil {
		opts.FindFilterFunc = DefaultFindFilterFunc
	}

	return &Discovery{
		findStep:       opts.FindFunc,
		findFilterStep: opts.FindFilterFunc,
		log:            log.New("plugins.discovery"),
	}
}

// Discover will execute the Find and Filter steps of the Discovery stage.
func (d *Discovery) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
	found, err := d.findStep(ctx, src)
	if err != nil {
		return nil, err
	}

	found, err = d.findFilterStep(ctx, found)
	if err != nil {
		return nil, err
	}

	return found, nil
}
