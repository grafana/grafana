package initialization

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/semconv"
)

// Initializer is responsible for the Initialization stage of the plugin loader pipeline.
type Initializer interface {
	Initialize(ctx context.Context, ps *plugins.Plugin) (*plugins.Plugin, error)
}

// InitializeFunc is the function used for the Initialize step of the Initialization stage.
type InitializeFunc func(ctx context.Context, p *plugins.Plugin) (*plugins.Plugin, error)

type Initialize struct {
	cfg             *config.PluginManagementCfg
	initializeSteps []InitializeFunc
	log             log.Logger
	tracer          trace.Tracer
}

type Opts struct {
	InitializeFuncs []InitializeFunc
}

// New returns a new Initialization stage.
func New(cfg *config.PluginManagementCfg, opts Opts) *Initialize {
	if opts.InitializeFuncs == nil {
		opts.InitializeFuncs = []InitializeFunc{}
	}

	return &Initialize{
		cfg:             cfg,
		initializeSteps: opts.InitializeFuncs,
		log:             log.New("plugins.initialization"),
		tracer:          otel.Tracer("github.com/grafana/grafana/pkg/plugins/manager/pipeline/initialization"),
	}
}

// Initialize will execute the Initialize steps of the Initialization stage.
func (i *Initialize) Initialize(ctx context.Context, ps *plugins.Plugin) (*plugins.Plugin, error) {
	ctx, span := i.tracer.Start(ctx, "initialization.Initialize", trace.WithAttributes(
		semconv.GrafanaPluginId(ps.ID),
	))
	defer span.End()

	if len(i.initializeSteps) == 0 {
		return ps, nil
	}

	var err error
	var ip *plugins.Plugin
	for _, init := range i.initializeSteps {
		ip, err = init(ctx, ps)
		if err != nil {
			i.log.Error("Could not initialize plugin", "pluginId", ps.ID, "error", err)
			return nil, tracing.Error(span, err)
		}
	}

	return ip, nil
}
