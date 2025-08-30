package dskitadapter

import (
	"context"
	"reflect"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanamodules "github.com/grafana/grafana/pkg/modules"
	servicetracing "github.com/grafana/grafana/pkg/modules/tracing"
	"github.com/grafana/grafana/pkg/registry"
)

type managerAdapter struct {
	reg     registry.BackgroundServiceRegistry
	manager grafanamodules.Engine
}

func NewManagerAdapter(reg registry.BackgroundServiceRegistry) *managerAdapter {
	return &managerAdapter{
		reg: reg,
	}
}

func (r *managerAdapter) Run(ctx context.Context) error {
	logger := log.New("backgroundsvcs-modules").FromContext(ctx)
	tracerProvider := trace.SpanFromContext(ctx).TracerProvider()
	manager := modules.NewManager(logger)
	deps := dependencyMap()
	for modName := range deps {
		manager.RegisterModule(modName, func() (services.Service, error) {
			return nil, nil
		})
	}
	for _, bgSvc := range r.reg.GetServices() {
		if s, ok := bgSvc.(registry.CanBeDisabled); ok && s.IsDisabled() {
			logger.Debug("service is disabled, skipping", "service", reflect.TypeOf(bgSvc).String())
			continue
		}
		namedService, ok := bgSvc.(services.NamedService)
		if !ok {
			// if the service is not a NamedService, try to convert it
			namedService = asNamedService(bgSvc)
		}
		namedService = servicetracing.NewServiceTracer(tracerProvider, namedService)
		manager.RegisterModule(namedService.ServiceName(), func() (services.Service, error) {
			return namedService, nil
		}, modules.UserInvisibleModule)

		// add the service as a background service dependency if it's not already in the dependency map
		if _, ok := deps[namedService.ServiceName()]; !ok {
			deps[namedService.ServiceName()] = []string{Core}
			deps[BackgroundServices] = append(deps[BackgroundServices], namedService.ServiceName())
		}
	}
	r.manager = grafanamodules.NewWithManager(logger, []string{All}, manager, deps)

	ctx, span := tracing.Start(ctx, "backgroundsvcs-modules.run")
	defer span.End()
	return r.manager.Run(ctx)
}

func (r *managerAdapter) Shutdown(ctx context.Context, reason string) error {
	if r.manager == nil {
		return nil
	}
	return r.manager.Shutdown(ctx, reason)
}
