package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

func ProvideDiscoveryStage(cfg *config.Cfg, pf finder.Finder, pr registry.Service) *discovery.Discovery {
	return discovery.New(cfg, discovery.Opts{
		FindFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
			return pf.Find(ctx, src)
		},
		FindFilterFuncs: []discovery.FindFilterFunc{
			func(ctx context.Context, _ plugins.Class, b []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return discovery.NewDuplicatePluginFilterStep(pr).Filter(ctx, b)
			},
		},
	})
}

func ProvideBootstrapStage(cfg *config.Cfg, sc plugins.SignatureCalculator, a *assetpath.Service) *bootstrap.Bootstrap {
	return bootstrap.New(cfg, bootstrap.Opts{
		ConstructFunc: bootstrap.DefaultConstructFunc(sc, a),
		DecorateFuncs: bootstrap.DefaultDecorateFuncs,
	})
}

func ProvideInitializationStage(cfg *config.Cfg, pr registry.Service, l plugins.Licensing, bp plugins.BackendFactoryProvider) *initialization.Initialize {
	return initialization.New(cfg, initialization.Opts{
		InitializeFuncs: []initialization.InitializeFunc{
			initialization.NewBackendClientInitStep(envvars.NewProvider(cfg, l), bp),
			initialization.NewPluginRegistrationStep(pr),
		},
	})
}
