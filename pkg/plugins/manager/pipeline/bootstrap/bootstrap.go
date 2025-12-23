package bootstrap

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/signature"
	"github.com/grafana/grafana/pkg/plugins/pluginassets"
	"github.com/grafana/grafana/pkg/semconv"
)

// Bootstrapper is responsible for the Bootstrap stage of the plugin loader pipeline.
type Bootstrapper interface {
	Bootstrap(ctx context.Context, src plugins.PluginSource, bundle *plugins.FoundBundle) ([]*plugins.Plugin, error)
}

// ConstructFunc is the function used for the Construct step of the Bootstrap stage.
type ConstructFunc func(ctx context.Context, src plugins.PluginSource, bundle *plugins.FoundBundle) ([]*plugins.Plugin, error)

// DecorateFunc is the function used for the Decorate step of the Bootstrap stage.
type DecorateFunc func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)

// Bootstrap implements the Bootstrapper interface.
//
// The Bootstrap stage is made up of the following steps (in order):
// - Construct: Create the initial plugin structs based on the plugin(s) found in the Discovery stage.
// - Decorate: Decorate the plugins with additional metadata.
//
// The Construct step is implemented by the ConstructFunc type.
//
// The Decorate step is implemented by the DecorateFunc type.
type Bootstrap struct {
	constructStep ConstructFunc
	decorateSteps []DecorateFunc
	log           log.Logger
	tracer        trace.Tracer
}

type Opts struct {
	ConstructFunc ConstructFunc
	DecorateFuncs []DecorateFunc
}

// New returns a new Bootstrap stage.
func New(cfg *config.PluginManagementCfg, opts Opts) *Bootstrap {
	if opts.ConstructFunc == nil {
		opts.ConstructFunc = DefaultConstructFunc(cfg, signature.DefaultCalculator(cfg), pluginassets.NewLocalProvider())
	}

	if opts.DecorateFuncs == nil {
		opts.DecorateFuncs = DefaultDecorateFuncs(cfg)
	}

	return &Bootstrap{
		constructStep: opts.ConstructFunc,
		decorateSteps: opts.DecorateFuncs,
		log:           log.New("plugins.bootstrap"),
		tracer:        otel.Tracer("github.com/grafana/grafana/pkg/plugins/manager/pipeline/bootstrap"),
	}
}

// Bootstrap will execute the Construct and Decorate steps of the Bootstrap stage.
func (b *Bootstrap) Bootstrap(ctx context.Context, src plugins.PluginSource, found *plugins.FoundBundle) ([]*plugins.Plugin, error) {
	pluginClass := src.PluginClass(ctx)
	ctx, span := b.tracer.Start(ctx, "bootstrap.Bootstrap", trace.WithAttributes(
		semconv.PluginSourceClass(pluginClass),
	))
	defer span.End()

	ps, err := b.constructStep(ctx, src, found)
	if err != nil {
		return nil, tracing.Error(span, err)
	}

	if len(b.decorateSteps) == 0 {
		return ps, nil
	}

	bootstrappedPlugins := make([]*plugins.Plugin, 0, len(ps))
	for _, p := range ps {
		var ip *plugins.Plugin
		for _, decorate := range b.decorateSteps {
			ip, err = decorate(ctx, p)
			if err != nil {
				b.log.Error("Could not decorate plugin", "pluginId", p.ID, "error", err)
				return nil, tracing.Error(span, err)
			}
		}
		bootstrappedPlugins = append(bootstrappedPlugins, ip)
	}

	return bootstrappedPlugins, nil
}
