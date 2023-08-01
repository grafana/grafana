package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	pluginsLoader "github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angularinspector"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/assetpath"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/oauth"
)

var _ plugins.ErrorResolver = (*Loader)(nil)
var _ pluginsLoader.Service = (*Loader)(nil)

type Loader struct {
	loader *pluginsLoader.Loader
}

func ProvideService(cfg *config.Cfg, authorizer plugins.PluginLoaderAuthorizer, processManager process.Service,
	pluginRegistry registry.Service, roleRegistry plugins.RoleRegistry, assetPath *assetpath.Service,
	angularInspector angularinspector.Inspector, externalServiceRegistry oauth.ExternalServiceRegistry,
	discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, initializer initialization.Initializer,
) *Loader {
	return &Loader{
		loader: pluginsLoader.New(cfg, authorizer, pluginRegistry, processManager, roleRegistry, assetPath,
			angularInspector, externalServiceRegistry, discovery, bootstrap, initializer),
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	return l.loader.Load(ctx, src)
}

func (l *Loader) Unload(ctx context.Context, pluginID string) error {
	return l.loader.Unload(ctx, pluginID)
}

func (l *Loader) PluginErrors() []*plugins.Error {
	return l.loader.PluginErrors()
}
