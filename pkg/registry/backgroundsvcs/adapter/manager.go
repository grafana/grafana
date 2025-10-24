package adapter

import (
	"context"
	"time"

	"github.com/grafana/dskit/services"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	grafanamodules "github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/registry"
)

var (
	stopTimeout = 5 * time.Second
)

type ManagerAdapter struct {
	services.NamedService

	reg           registry.BackgroundServiceRegistry
	manager       grafanamodules.Manager
	dependencyMap map[string][]string
}

// NewManagerAdapter creates a new manager adapter that bridges Grafana's background
// service registry with dskit's module and service patterns. The adapter converts background
// services to dskit services and manages them using dskit's module Manager, which provides:
//   - Coordinated service initialization
//   - Observable service states and health monitoring
//   - Graceful shutdown with proper cleanup ordering
//
// Services implementing CanBeDisabled that are disabled will be skipped.
func NewManagerAdapter(reg registry.BackgroundServiceRegistry) *ManagerAdapter {
	m := &ManagerAdapter{
		reg:           reg,
		dependencyMap: dependencyMap(),
	}
	m.NamedService = services.NewBasicService(m.starting, m.running, m.stopping).WithName("backgroundsvcs.managerAdapter")
	return m
}

func (m *ManagerAdapter) WithDependencies(dependencyMap map[string][]string) *ManagerAdapter {
	m.dependencyMap = dependencyMap
	return m
}

func (m *ManagerAdapter) starting(ctx context.Context) error {
	spanCtx, span := tracing.Start(ctx, "backgroundsvcs.managerAdapter.starting")
	defer span.End()
	logger := log.New("backgroundsvcs.managerAdapter").FromContext(spanCtx)
	manager := grafanamodules.New(logger, []string{BackgroundServices}).WithDependencies(m.dependencyMap)

	for _, bgSvc := range m.reg.GetServices() {
		//only wrap background services that are not already a NamedService
		namedService, ok := bgSvc.(services.NamedService)
		if !ok {
			namedService = asNamedService(bgSvc)
		}

		// skip disabled services
		if s, ok := bgSvc.(registry.CanBeDisabled); ok && s.IsDisabled() {
			logger.Debug("Skipping disabled service", "service", namedService.ServiceName())
			manager.RegisterInvisibleModule(namedService.ServiceName(), nil)
			continue
		}

		// register the service as an invisible module
		manager.RegisterInvisibleModule(namedService.ServiceName(), func() (services.Service, error) {
			return namedService, nil
		})

		// add the service as a background service dependency if it's not already in the dependency map
		if _, ok := m.dependencyMap[namedService.ServiceName()]; !ok {
			m.dependencyMap[namedService.ServiceName()] = []string{Core}
			m.dependencyMap[BackgroundServices] = append(m.dependencyMap[BackgroundServices], namedService.ServiceName())
		}
	}

	manager.RegisterModule(Core, nil)
	manager.RegisterModule(BackgroundServices, nil)

	m.manager = manager
	if err := m.manager.StartAsync(spanCtx); err != nil {
		return err
	}
	return m.manager.AwaitRunning(spanCtx)
}

func (m *ManagerAdapter) running(ctx context.Context) error {
	newCtx := trace.ContextWithSpan(context.Background(), trace.SpanFromContext(ctx))
	spanCtx, span := tracing.Start(newCtx, "backgroundsvcs.managerAdapter.running")
	defer span.End()
	return m.manager.AwaitTerminated(spanCtx)
}

func (m *ManagerAdapter) stopping(failure error) error {
	ctx, cancel := context.WithTimeout(context.Background(), stopTimeout)
	defer cancel()
	spanCtx, span := tracing.Start(ctx, "backgroundsvcs.managerAdapter.stopping")
	defer span.End()
	reason := ""
	if failure != nil {
		reason = failure.Error()
	}
	return m.manager.Shutdown(spanCtx, reason)
}

// Run initializes and starts all background services using dskit's module and service patterns.
func (m *ManagerAdapter) Run(ctx context.Context) error {
	if err := m.StartAsync(ctx); err != nil {
		return err
	}
	stopCtx := trace.ContextWithSpan(context.Background(), trace.SpanFromContext(ctx))
	return m.AwaitTerminated(stopCtx)
}

// Shutdown calls calls the underlying manager's Shutdown
func (m *ManagerAdapter) Shutdown(ctx context.Context, reason string) error {
	m.StopAsync()
	return m.AwaitTerminated(ctx)
}
