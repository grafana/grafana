package loader

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
	pluginsCfg "github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/termination"
	"github.com/grafana/grafana/pkg/plugins/manager/pipeline/validation"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginerrs"
)

const concurrencyLimit = 32

type Loader struct {
	cfg          *pluginsCfg.PluginManagementCfg
	discovery    discovery.Discoverer
	bootstrap    bootstrap.Bootstrapper
	initializer  initialization.Initializer
	termination  termination.Terminator
	validation   validation.Validator
	errorTracker pluginerrs.ErrorTracker
	log          log.Logger
}

func New(
	cfg *pluginsCfg.PluginManagementCfg,
	discovery discovery.Discoverer, bootstrap bootstrap.Bootstrapper, validation validation.Validator,
	initializer initialization.Initializer, termination termination.Terminator, errorTracker pluginerrs.ErrorTracker,
) *Loader {
	return &Loader{
		cfg:          cfg,
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

	st := time.Now()
	discoveredPlugins, err := l.discovery.Discover(ctx, src)
	if err != nil {
		return nil, err
	}
	l.log.Debug("Discovered", "class", src.PluginClass(ctx), "duration", time.Since(st))

	st = time.Now()
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
	l.log.Debug("Bootstrapped", "class", src.PluginClass(ctx), "duration", time.Since(st))

	st = time.Now()
	validatedPlugins := []*plugins.Plugin{}
	type validateResult struct {
		bootstrappedPlugin *plugins.Plugin
		err                error
	}
	validateResults := make(chan validateResult, len(bootstrappedPlugins))

	// If the PluginsCDNSyncLoaderEnabled feature is enabled, validate plugins in parallel.
	// Otherwise, validate plugins sequentially.
	var limitSize int
	if l.cfg.Features.PluginsCDNSyncLoaderEnabled && src.PluginClass(ctx) == plugins.ClassCDN {
		limitSize = min(len(bootstrappedPlugins), concurrencyLimit)
	} else {
		limitSize = 1
	}
	limit := make(chan struct{}, limitSize)
	for _, bootstrappedPlugin := range bootstrappedPlugins {
		limit <- struct{}{}
		go func(p *plugins.Plugin) {
			err := l.validation.Validate(ctx, p)
			validateResults <- validateResult{
				bootstrappedPlugin: bootstrappedPlugin,
				err:                err,
			}
			<-limit
		}(bootstrappedPlugin)
	}
	for i := 0; i < len(bootstrappedPlugins); i++ {
		r := <-validateResults
		if r.err != nil {
			l.recordError(ctx, r.bootstrappedPlugin, r.err)
			continue
		}
		validatedPlugins = append(validatedPlugins, r.bootstrappedPlugin)
	}
	l.log.Debug("Validated", "class", src.PluginClass(ctx), "duration", time.Since(st), "total", len(validatedPlugins))

	st = time.Now()
	initializedPlugins := []*plugins.Plugin{}
	for _, validatedPlugin := range validatedPlugins {
		initializedPlugin, err := l.initializer.Initialize(ctx, validatedPlugin)
		if err != nil {
			l.recordError(ctx, validatedPlugin, err)
			continue
		}
		initializedPlugins = append(initializedPlugins, initializedPlugin)
	}
	l.log.Debug("Initialized", "class", src.PluginClass(ctx), "duration", time.Since(st))

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
