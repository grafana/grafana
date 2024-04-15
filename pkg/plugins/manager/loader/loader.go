package loader

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
)

type Loader struct {
	discovery    discovery.Discoverer
	bootstrap    bootstrap.Bootstrapper
	initializer  initialization.Initializer
	termination  termination.Terminator
	validation   validation.Validator
	errorTracker pluginerrs.ErrorTracker
	log          log.Logger
}

func New(discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, validation validation.Validator,
	initializer initialization.Initializer, termination termination.Terminator, errorTracker pluginerrs.ErrorTracker) *Loader {
	return &Loader{
		discovery:    discovery,
		bootstrap:    bootstrap,
		validation:   validation,
		initializer:  initializer,
		termination:  termination,
		errorTracker: errorTracker,
		log:          log.New("plugin.loader"),
	}
}

func (l *Loader) recordError(ctx context.Context, p *plugins.Plugin, err error) {
	var pErr *plugins.Error
	if errors.As(err, &pErr) {
		l.errorTracker.Record(ctx, pErr)
		return
	}
	l.errorTracker.Record(ctx, &plugins.Error{
		PluginID:  p.ID,
		ErrorCode: plugins.ErrorCode(err.Error()),
	})
}

func (l *Loader) Load(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
	end := l.instrumentLoad(ctx, src)

	discoveredPlugins, err := l.discovery.Discover(ctx, src)
	if err != nil {
		return nil, err
	}

	bootstrappedPlugins := []*plugins.Plugin{}
	for _, foundBundle := range discoveredPlugins {
		bootstrappedPlugin, err := l.bootstrap.Bootstrap(ctx, src, foundBundle)
		if err != nil {
			l.errorTracker.Record(ctx, &plugins.Error{
				PluginID:  foundBundle.Primary.JSONData.ID,
				ErrorCode: plugins.ErrorCode(err.Error()),
			})
			continue
		}
		bootstrappedPlugins = append(bootstrappedPlugins, bootstrappedPlugin...)
	}

	validatedPlugins := []*plugins.Plugin{}
	for _, bootstrappedPlugin := range bootstrappedPlugins {
		err := l.validation.Validate(ctx, bootstrappedPlugin)
		if err != nil {
			l.recordError(ctx, bootstrappedPlugin, err)
			continue
		}
		validatedPlugins = append(validatedPlugins, bootstrappedPlugin)
	}

	initializedPlugins := []*plugins.Plugin{}
	for _, validatedPlugin := range validatedPlugins {
		initializedPlugin, err := l.initializer.Initialize(ctx, validatedPlugin)
		if err != nil {
			l.recordError(ctx, validatedPlugin, err)
			continue
		}
		initializedPlugins = append(initializedPlugins, initializedPlugin)
	}

	// Clean errors from registry for initialized plugins
	for _, p := range initializedPlugins {
		l.errorTracker.Clear(ctx, p.ID)
	}

	end(initializedPlugins)

	return initializedPlugins, nil
}

func (l *Loader) Unload(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	return l.termination.Terminate(ctx, p)
}

func (l *Loader) instrumentLoad(ctx context.Context, src plugins.PluginSource) func([]*plugins.Plugin) {
	start := time.Now()
	sourceLogger := l.log.New("source", src.PluginClass(ctx)).FromContext(ctx)
	sourceLogger.Debug("Loading plugin source...")

	return func(logger log.Logger, start time.Time) func([]*plugins.Plugin) {
		return func(plugins []*plugins.Plugin) {
			if len(plugins) == 0 {
				logger.Debug("Plugin source loaded, though no plugins were found")
				return
			}
			names := make([]string, len(plugins))
			for i, p := range plugins {
				names[i] = p.ID
			}
			sort.Strings(names)
			pluginsStr := strings.Join(names, ", ")

			logger.Debug("Plugin source loaded", "plugins", pluginsStr, "duration", time.Since(start))
		}
	}(sourceLogger, start)
}
