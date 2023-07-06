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

type FoundFilterFunc func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

var DefaultFoundFilterFunc = func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
	return bundles, nil
}

type BootstrapFunc func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error)

var DefaultBootstrapFunc = func(signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) BootstrapFunc {
	return NewDefaultBootstrapper(signatureCalculator, assetPath).Bootstrap
}

type Discovery struct {
	findFunc             FindFunc
	findResultFilterFunc FoundFilterFunc
	bootstrapFunc        BootstrapFunc
	log                  log.Logger
}

type Opts struct {
	FindFunc             FindFunc
	FindResultFilterFunc FoundFilterFunc
	BootstrapFunc        BootstrapFunc
}

func New(cfg *config.Cfg, opts ...Opts) *Discovery {
	if len(opts) > 1 {
		panic("only one opts argument allowed")
	}

	if len(opts) == 0 {
		opts = []Opts{
			{
				FindFunc:             DefaultFindFunc(cfg),
				FindResultFilterFunc: DefaultFoundFilterFunc,
				BootstrapFunc:        DefaultBootstrapFunc(signature.DefaultCalculator(), assetpath.DefaultService(cfg)),
			},
		}
	}

	if opts[0].FindFunc == nil {
		opts[0].FindFunc = DefaultFindFunc(cfg)
	}

	if opts[0].FindResultFilterFunc == nil {
		opts[0].FindResultFilterFunc = DefaultFoundFilterFunc
	}

	if opts[0].BootstrapFunc == nil {
		opts[0].BootstrapFunc = DefaultBootstrapFunc(signature.DefaultCalculator(), assetpath.DefaultService(cfg))
	}

	return &Discovery{
		findFunc:             opts[0].FindFunc,
		findResultFilterFunc: opts[0].FindResultFilterFunc,
		bootstrapFunc:        opts[0].BootstrapFunc,
		log:                  log.New("plugins.discovery"),
	}
}

func NewDiscoveryStage(pluginFinder finder.Finder, pluginRegistry registry.Service,
	signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *Discovery {
	return &Discovery{
		findFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
			return pluginFinder.Find(ctx, src)
		},
		findResultFilterFunc: func(ctx context.Context, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
			return NewDuplicatePluginFilterStep(pluginRegistry).Filter(ctx, bundles)
		},
		bootstrapFunc: func(ctx context.Context, src plugins.PluginSource, bundles []*plugins.FoundBundle) ([]*plugins.Plugin, error) {
			return NewDefaultBootstrapper(signatureCalculator, assetPath).Bootstrap(ctx, src, bundles)
		},
		log: log.New("plugins.discovery"),
	}
}

func (d *Discovery) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	found, err := d.findFunc(ctx, src)
	if err != nil {
		return nil, err
	}

	found, err = d.findResultFilterFunc(ctx, found)
	if err != nil {
		return nil, err
	}

	ps, err := d.bootstrapFunc(ctx, src, found)
	if err != nil {
		return nil, err
	}

	return ps, nil
}
