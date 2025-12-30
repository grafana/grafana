package discovery

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

// Discoverer is responsible for the Discovery stage of the plugin loader pipeline.
type Discoverer interface {
	Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error)
}

// FilterFunc is the function used for the Filter step of the Discovery stage.
type FilterFunc func(ctx context.Context, class plugins.Class, bundles []*plugins.FoundBundle) ([]*plugins.FoundBundle, error)

// Discovery implements the Discoverer interface.
//
// The Discovery stage is made up of the following steps (in order):
// - Discover: Each source discovers its own plugins
// - Filter: Filter the results based on some criteria.
//
// The Filter step is implemented by the FilterFunc type.
type Discovery struct {
	filterSteps []FilterFunc
	log         log.Logger
	tracer      trace.Tracer
}

type Opts struct {
	FilterFuncs []FilterFunc
}

// New returns a new Discovery stage.
func New(_ *config.PluginManagementCfg, opts Opts) *Discovery {
	if opts.FilterFuncs == nil {
		opts.FilterFuncs = []FilterFunc{} // no filters by default
	}

	return &Discovery{
		filterSteps: opts.FilterFuncs,
		log:         log.New("plugins.discovery"),
		tracer:      otel.Tracer("github.com/grafana/grafana/pkg/plugins/manager/pipeline/discovery"),
	}
}

// Discover will execute the Filter step of the Discovery stage.
func (d *Discovery) Discover(ctx context.Context, src plugins.PluginSource) ([]*plugins.FoundBundle, error) {
	pluginClass := src.PluginClass(ctx)
	ctx, span := d.tracer.Start(ctx, "discovery.Discover", trace.WithAttributes(
		attribute.String("grafana.plugins.class", string(pluginClass)),
	))
	defer span.End()
	ctxLogger := d.log.FromContext(ctx)

	// Use the source's own Discover method
	found, err := src.Discover(ctx)
	if err != nil {
		ctxLogger.Warn("Discovery source failed", "class", pluginClass, "error", err)
		return nil, tracing.Error(span, err)
	}

	ctxLogger.Debug("Found plugins", "class", pluginClass, "count", len(found))

	// Apply filtering steps
	result := found
	for _, filter := range d.filterSteps {
		result, err = filter(ctx, src.PluginClass(ctx), result)
		if err != nil {
			return nil, tracing.Error(span, err)
		}
	}

	ctxLogger.Debug("Discovery complete", "class", pluginClass, "found", len(found), "filtered", len(result))
	return result, nil
}
