package discovery

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

type Discoverer interface {
	Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
}

type FindFunc func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)

type FindFilterFunc func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

type Discovery struct {
	findStep       FindFunc
	findFilterStep FindFilterFunc
	log            log.Logger
}

type Opts struct {
	FindFunc       FindFunc
	FindFilterFunc FindFilterFunc
}

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

func NewDiscoveryStage(pluginFinder finder.Finder, pluginRegistry registry.Service) *Discovery {
	return &Discovery{
		findStep: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
			return pluginFinder.Find(ctx, src)
		},
		findFilterStep: func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
			return NewDuplicatePluginFilterStep(pluginRegistry).Filter(ctx, bundles)
		},
		log: log.New("plugins.discovery"),
	}
}

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
