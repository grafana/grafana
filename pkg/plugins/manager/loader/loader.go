package loader

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/grafanaconv"
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
	tracer       trace.Tracer
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
		tracer:       otel.Tracer("github.com/grafana/grafana/pkg/plugins/manager/loader"),
	}
}

func (l *Loader) recordError(ctx context.Context, p *plugins.Plugin, err error) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		if p != nil {
			span.SetAttributes(grafanaconv.PluginErrorCode(err.Error()))
		}
	}

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
	// Create main plugin load span
	ctx, span := grafanaconv.PluginLoadSpan(ctx, l.tracer)
	defer span.End()

	// Set plugin class attribute
	pluginClass := src.PluginClass(ctx)
	span.SetAttributes(grafanaconv.PluginClassKey.String(string(pluginClass)))

	end := l.instrumentLoad(ctx, src)

	st := time.Now()
	discoverCtx, discoverSpan := grafanaconv.PluginDiscoverSpan(ctx, l.tracer)
	discoverSpan.SetAttributes(grafanaconv.PluginClassKey.String(string(pluginClass)))
	discoveredPlugins, err := l.discovery.Discover(discoverCtx, src)
	if err != nil {
		discoverSpan.SetStatus(codes.Error, err.Error())
		discoverSpan.RecordError(err)
		defer discoverSpan.End()
		return nil, err
	}
	l.log.Debug("Discovered", "class", src.PluginClass(ctx), "duration", time.Since(st))
	discoverSpan.SetStatus(codes.Ok, "")
	discoverSpan.End()

	st = time.Now()
	bootstrappedPlugins := []*plugins.Plugin{}
	for _, foundBundle := range discoveredPlugins {
		// Create bootstrap span for each plugin
		bootstrapCtx, bootstrapSpan := grafanaconv.PluginBootstrapSpan(ctx, l.tracer)
		bootstrapSpan.SetAttributes(
			grafanaconv.PluginClassKey.String(string(pluginClass)),
			grafanaconv.PluginID(foundBundle.Primary.JSONData.ID),
			grafanaconv.PluginTypeKey.String(string(foundBundle.Primary.JSONData.Type)),
		)

		bootstrappedPlugin, err := l.bootstrap.Bootstrap(bootstrapCtx, src, foundBundle)
		if err != nil {
			bootstrapSpan.SetStatus(codes.Error, err.Error())
			bootstrapSpan.RecordError(err)
			bootstrapSpan.SetAttributes(grafanaconv.PluginErrorCode(err.Error()))
			bootstrapSpan.End()

			l.errorTracker.Record(ctx, &plugins.Error{
				PluginID:  foundBundle.Primary.JSONData.ID,
				ErrorCode: plugins.ErrorCode(err.Error()),
			})
			continue
		}
		bootstrappedPlugins = append(bootstrappedPlugins, bootstrappedPlugin...)
		bootstrapSpan.SetStatus(codes.Ok, "")
		bootstrapSpan.End()
	}
	l.log.Debug("Bootstrapped", "class", src.PluginClass(ctx), "duration", time.Since(st))

	st = time.Now()
	validatedPlugins := []*plugins.Plugin{}
	type validateResult struct {
		bootstrappedPlugin *plugins.Plugin
		err                error
	}
	validateResults := make(chan validateResult, len(bootstrappedPlugins))

	var limitSize int
	if src.PluginClass(ctx) == plugins.ClassCDN {
		limitSize = min(len(bootstrappedPlugins), concurrencyLimit)
	} else {
		limitSize = 1
	}
	limit := make(chan struct{}, limitSize)
	for _, bootstrappedPlugin := range bootstrappedPlugins {
		limit <- struct{}{}
		go func(p *plugins.Plugin) {
			// Create validation span for each plugin
			validateSpanCtx, validateSpan := grafanaconv.PluginValidateSpan(ctx, l.tracer)
			validateSpan.SetAttributes(
				grafanaconv.PluginClassKey.String(string(pluginClass)),
				grafanaconv.PluginID(p.ID),
				grafanaconv.PluginTypeKey.String(string(p.Type)),
			)

			err := l.validation.Validate(validateSpanCtx, p)
			if err != nil {
				validateSpan.SetStatus(codes.Error, err.Error())
				validateSpan.RecordError(err)
				validateSpan.SetAttributes(grafanaconv.PluginErrorCode(err.Error()))
			}
			validateSpan.End()

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
		// Create initialization span for each plugin
		initCtx, initSpan := grafanaconv.PluginInitializeSpan(ctx, l.tracer)
		initSpan.SetAttributes(
			grafanaconv.PluginClassKey.String(string(pluginClass)),
			grafanaconv.PluginID(validatedPlugin.ID),
			grafanaconv.PluginTypeKey.String(string(validatedPlugin.Type)),
		)

		initializedPlugin, err := l.initializer.Initialize(initCtx, validatedPlugin)
		if err != nil {
			initSpan.SetStatus(codes.Error, err.Error())
			initSpan.RecordError(err)
			initSpan.SetAttributes(grafanaconv.PluginErrorCode(err.Error()))
			initSpan.End()

			l.recordError(ctx, validatedPlugin, err)
			continue
		}
		initializedPlugins = append(initializedPlugins, initializedPlugin)
		initSpan.End()
	}
	l.log.Debug("Initialized", "class", src.PluginClass(ctx), "duration", time.Since(st))

	// Clean errors from registry for initialized plugins
	for _, p := range initializedPlugins {
		l.errorTracker.Clear(ctx, p.ID)
	}

	// Set final attributes on main span
	span.SetAttributes(grafanaconv.PluginCount(len(initializedPlugins)))
	span.SetStatus(codes.Ok, "")

	end(initializedPlugins)

	return initializedPlugins, nil
}

func (l *Loader) Unload(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
	// Create unload span
	ctx, span := grafanaconv.PluginUnloadSpan(ctx, l.tracer)
	defer span.End()

	span.SetAttributes(
		grafanaconv.PluginID(p.ID),
		grafanaconv.PluginTypeKey.String(string(p.Type)),
	)

	result, err := l.termination.Terminate(ctx, p)
	if err != nil {
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		span.SetAttributes(grafanaconv.PluginErrorCode(err.Error()))
	}

	return result, err
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
