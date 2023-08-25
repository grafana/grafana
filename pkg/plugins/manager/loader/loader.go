package loader

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
)

type Loader struct {
	discovery   discovery.Discoverer
	bootstrap   bootstrap.Bootstrapper
	initializer initialization.Initializer
	termination termination.Terminator
	validation  validation.Validator
	log         log.Logger
}

func New(discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, validation validation.Validator,
	initializer initialization.Initializer, termination termination.Terminator) *Loader {
	return &Loader{
		discovery:   discovery,
		bootstrap:   bootstrap,
		validation:  validation,
		initializer: initializer,
		termination: termination,
		log:         log.New("plugin.loader"),
	}
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	discoveredPlugins, err := l.discovery.Discover(ctx, src)
	if err != nil {
		return nil, err
	}

	bootstrappedPlugins, err := l.bootstrap.Bootstrap(ctx, src, discoveredPlugins)
	if err != nil {
		return nil, err
	}

	validatedPlugins, err := l.validation.Validate(ctx, bootstrappedPlugins)
	if err != nil {
		return nil, err
	}

	initializedPlugins, err := l.initializer.Initialize(ctx, validatedPlugins)
	if err != nil {
		return nil, err
	}

	return initializedPlugins, nil
}

func (l *Loader) Unload(ctx context.Context, pluginID, version string) error {
	return l.termination.Terminate(ctx, pluginID, version)
}
