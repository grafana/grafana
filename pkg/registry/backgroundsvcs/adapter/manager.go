package adapter

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/dskit/services"

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
	dependencyMap map[string][]string

	// mu guards manager, written on the service goroutine.
	mu      sync.Mutex
	manager grafanamodules.Manager
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

	m.setManager(manager)
	if err := manager.StartAsync(spanCtx); err != nil {
		return err
	}
	if err := manager.AwaitRunning(spanCtx); err != nil {
		if failure := manager.FailureCase(); failure != nil {
			err = failure
		}
		shutdownCtx, cancel := context.WithTimeout(context.Background(), stopTimeout)
		defer cancel()
		if shutdownErr := manager.Shutdown(shutdownCtx, err.Error()); shutdownErr != nil {
			return errors.Join(err, shutdownErr)
		}
		return err
	}
	return nil
}

// running is not traced: it lasts as long as the process, so its span would only
// be exported at exit.
func (m *ManagerAdapter) running(ctx context.Context) error {
	return m.moduleManager().AwaitTerminated(context.Background())
}

// stopping is a no-op once Shutdown has stopped the modules, and only does the work
// itself when the adapter was stopped some other way.
func (m *ManagerAdapter) stopping(failure error) error {
	ctx, cancel := context.WithTimeout(context.Background(), stopTimeout)
	defer cancel()
	reason := ""
	if failure != nil {
		reason = failure.Error()
	}
	return m.moduleManager().Shutdown(ctx, reason)
}

func (m *ManagerAdapter) setManager(manager grafanamodules.Manager) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.manager = manager
}

func (m *ManagerAdapter) moduleManager() grafanamodules.Manager {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.manager
}

// Run initializes and starts all background services using dskit's module and service patterns.
func (m *ManagerAdapter) Run(ctx context.Context) error {
	if err := m.StartAsync(ctx); err != nil {
		return err
	}
	// Detached from ctx, whose span covers startup only.
	return m.AwaitTerminated(context.Background())
}

// Shutdown calls calls the underlying manager's Shutdown
func (m *ManagerAdapter) Shutdown(ctx context.Context, reason string) error {
	// Stopping the modules through their own manager, rather than by cancelling this
	// service, is what puts the shutdown trace in place before any of them enters
	// Stopping. It also terminates this service, since running waits on them.
	var shutdownErr error
	if manager := m.moduleManager(); manager != nil {
		shutdownErr = manager.Shutdown(ctx, reason)
	}
	// Not returned early on error: this service still has to be stopped, or Run
	// blocks forever.
	m.StopAsync()
	if err := m.AwaitTerminated(ctx); err != nil {
		if shutdownErr != nil {
			return errors.Join(shutdownErr, err)
		}
		return err
	}
	return shutdownErr
}
