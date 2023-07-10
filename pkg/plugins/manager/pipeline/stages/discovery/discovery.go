package discovery

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
)

type Discoverer interface {
	Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error)
}

type FindFunc func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)

var DefaultFindFunc = func(cfg *config.Cfg) FindFunc {
	return finder.NewLocalFinder(cfg).Find
}

type FindFilterFunc func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

var DefaultFindFilterFunc = func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	return bundles, nil
}

type BootstrapFunc func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)

var DefaultBootstrapFunc = func(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) BootstrapFunc {
	return NewDefaultBootstrapper(signatureCalculator, assetPath).Bootstrap
}

type Discovery struct {
	findStep       FindFunc
	findFilterStep FindFilterFunc
	bootstrapStep  BootstrapFunc
	log            log.Logger
}

type Opts struct {
	FindFunc       FindFunc
	FindFilterFunc FindFilterFunc
	BootstrapFunc  BootstrapFunc
}

func New(cfg *config.Cfg, opts Opts) *Discovery {
	if opts.FindFunc == nil {
		opts.FindFunc = DefaultFindFunc(cfg)
	}

	if opts.FindFilterFunc == nil {
		opts.FindFilterFunc = DefaultFindFilterFunc
	}

	if opts.BootstrapFunc == nil {
		opts.BootstrapFunc = DefaultBootstrapFunc(signature.DefaultCalculator(), assetpath.DefaultService(cfg))
	}

	return &Discovery{
		findStep:       opts.FindFunc,
		findFilterStep: opts.FindFilterFunc,
		bootstrapStep:  opts.BootstrapFunc,
		log:            log.New("plugins.discovery"),
	}
}

func NewDiscoveryStage(pluginFinder finder.Finder, pluginRegistry registry.Service,
	signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *Discovery {
	return &Discovery{
		findStep: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
			return pluginFinder.Find(ctx, src)
		},
		findFilterStep: func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
			return NewDuplicatePluginFilterStep(pluginRegistry).Filter(ctx, bundles)
		},
		bootstrapStep: func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
			return NewDefaultBootstrapper(signatureCalculator, assetPath).Bootstrap(ctx, src, bundles)
		},
		log: log.New("plugins.discovery"),
	}
}

func (d *Discovery) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	found, err := d.findStep(ctx, src)
	if err != nil {
		return nil, err
	}

	found, err = d.findFilterStep(ctx, found)
	if err != nil {
		return nil, err
	}

	ps, err := d.bootstrapStep(ctx, src, found)
	if err != nil {
		return nil, err
	}

	return ps, nil
}
