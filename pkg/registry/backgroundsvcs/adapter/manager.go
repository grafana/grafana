package adapter

import (
	"context"
	"reflect"
	"sync"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanamodules "github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
)

type managerAdapter struct {
	reg     registry.BackgroundServiceRegistry
	manager grafanamodules.Engine
	mu      sync.RWMutex // protects manager field from concurrent access
}

// NewManagerAdapter creates a new manager adapter that bridges Grafana's background
// service registry with dskit's module and service patterns. The adapter converts background
// services to dskit services and manages them using dskit's module Manager, which provides:
//   - Coordinated service initialization
//   - Observable service states and health monitoring
//   - Graceful shutdown with proper cleanup ordering
func NewManagerAdapter(reg registry.BackgroundServiceRegistry) *managerAdapter {
	return &managerAdapter{
		reg: reg,
	}
}

// Run initializes and starts all background services using dskit's module and service patterns.
//
//  1. Convert each registry.BackgroundService to a dskit service.NamedService (unless it already implements NamedService)
//  2. Register the services with the dskit module Manager
//  3. If the service is not already present in the dependency map, add it as a dependency of the `BackgroundServices` module
//  4. Initialize all services in the order of the dependency map
//
// Services implementing CanBeDisabled that are disabled will be skipped.
// The method blocks until the context is cancelled or a service fails.
func (r *managerAdapter) Run(ctx context.Context) error {
	spanCtx, span := tracing.Start(ctx, "backgroundsvcs.adapter.Run")
	defer span.End()

	logger := log.New("backgroundsvcs.adapter").FromContext(spanCtx)
	manager := modules.NewManager(logger)

	deps := dependencyMap()

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
		manager.RegisterModule(namedService.ServiceName(), func() (services.Service, error) {
			return namedService, nil
		}, modules.UserInvisibleModule)

		// add the service as a background service dependency if it's not already in the dependency map
		if _, ok := deps[namedService.ServiceName()]; !ok {
			deps[namedService.ServiceName()] = []string{Core}
			deps[BackgroundServices] = append(deps[BackgroundServices], namedService.ServiceName())
		}
	}

	// any modules in the dependency map that haven't been registered should be registered.
	// this should only include modules like all and core.
	for modName := range deps {
		if manager.IsModuleRegistered(modName) {
			continue
		}
		logger.Debug("registering virtual module", "module", modName)
		manager.RegisterModule(modName, nil)
	}

	r.mu.Lock()
	r.manager = grafanamodules.NewWithManager(logger, []string{BackgroundServices}, manager, deps)
	r.mu.Unlock()

	logger.Debug("starting background services")
	return r.manager.Run(spanCtx)
}

// Shutdown calls calls the underlying manager's Shutdown method if it has been initialized.
func (r *managerAdapter) Shutdown(ctx context.Context, reason string) error {
	r.mu.RLock()
	manager := r.manager
	r.mu.RUnlock()

	if manager == nil {
		return nil
	}
	return manager.Shutdown(ctx, reason)
}
