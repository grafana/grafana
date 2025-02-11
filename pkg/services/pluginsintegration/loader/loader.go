package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	pluginsLoader "github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
)

var _ pluginsLoader.Service = (*Loader)(nil)

type Loader struct {
	loader *pluginsLoader.Loader
}

func ProvideService(
	cfg *config.PluginManagementCfg,
	discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, validation validation.Validator,
	initializer initialization.Initializer, termination termination.Terminator, errorTracker pluginerrs.ErrorTracker,
) *Loader {
	return &Loader{
		loader: pluginsLoader.New(cfg, discovery, bootstrap, validation, initializer, termination, errorTracker),
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	return l.loader.Load(ctx, src)
}

func (l *Loader) Unload(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	return l.loader.Unload(ctx, p)
}
