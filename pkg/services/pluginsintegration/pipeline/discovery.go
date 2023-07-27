package pipeline

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/finder"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
)

func ProvideDiscoveryStage(cfg *config.Cfg, pluginFinder finder.Finder, pluginRegistry registry.Service) *discovery.Discovery {
	return discovery.New(cfg, discovery.Opts{
		FindFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
			return pluginFinder.Find(ctx, src)
		},
		FindFilterFuncs: []discovery.FindFilterFunc{
			func(ctx context.Context, _ plugins.Class, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error) {
				return discovery.NewDuplicatePluginFilterStep(pluginRegistry).Filter(ctx, bundles)
			},
		},
	})
}

func ProvideBootstrapStage(cfg *config.Cfg, signatureCalculator plugins.SignatureCalculator, assetPath *assetpath.Service) *bootstrap.Bootstrap {
	return bootstrap.New(cfg, bootstrap.Opts{
		ConstructFunc: bootstrap.DefaultConstructFunc(signatureCalculator, assetPath),
		DecorateFuncs: bootstrap.DefaultDecorateFuncs,
	})
}
