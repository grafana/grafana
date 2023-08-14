package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	pluginsLoader "github.com/grafana/grafana/pkg/plugins/manager/loader"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
)

var _ pluginsLoader.Service = (*Loader)(nil)

type Loader struct {
	loader *pluginsLoader.Loader
}

func ProvideService(discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, validation validation.Validator,
	initializer initialization.Initializer, termination termination.Terminator,
) *Loader {
	return &Loader{
		loader: pluginsLoader.New(discovery, bootstrap, validation, initializer, termination),
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	return l.loader.Load(ctx, src)
}

func (l *Loader) Unload(ctx context.Context, pluginID string) error {
	return l.loader.Unload(ctx, pluginID)
}
