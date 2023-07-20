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
	Run(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
}

type FindStep func(ctx context.Context, prev []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

type Discovery struct {
	// Services
	pluginFinder   finder.Finder
	pluginRegistry registry.Service
	// Assets
	src plugins.PluginSource
	// Misc
	devMode bool
	steps   []FindStep
	log     log.Logger
}

func New(cfg *config.Cfg, pluginFinder finder.Finder, pluginRegistry registry.Service) *Discovery {
	d := &Discovery{
		pluginFinder:   pluginFinder,
		pluginRegistry: pluginRegistry,
		log:            log.New("plugins.discovery"),
		devMode:        cfg.DevMode,
	}
	return d
}

func (d *Discovery) Run(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
	// Init
	d.src = src
	// Run
	res := []*plugins.FoundBundle{}
	for _, step := range d.steps {
		ps, err := step(ctx, res)
		if err != nil {
			return nil, err
		}
		res = ps
	}
	return res, nil
}
