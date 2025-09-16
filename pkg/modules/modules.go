package modules

import (
	"context"
	"errors"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	infratracing "github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules/tracing"
)

type Engine interface {
	Run(context.Context) error
	Shutdown(context.Context, string) error
}

type Registry interface {
	RegisterModule(name string, fn func() (services.Service, error))
	RegisterInvisibleModule(name string, fn func() (services.Service, error))
}

type Manager interface {
	Registry
	Engine
}

var _ Engine = (*service)(nil)
var _ Registry = (*service)(nil)

// service manages the registration and lifecycle of modules.
type service struct {
	services.NamedService

	log           log.Logger
	targets       []string
	dependencyMap map[string][]string

	moduleManager  *tracing.ModuleManagerWrapper
	serviceManager *services.Manager
	serviceMap     map[string]services.Service
}

func New(
	logger log.Logger,
	targets []string,
) *service {
	s := &service{
		log:           logger,
		targets:       targets,
		dependencyMap: dependencyMap,
		moduleManager: tracing.WrapModuleManager(modules.NewManager(logger)),
		serviceMap:    map[string]services.Service{},
	}
	s.NamedService = services.NewBasicService(s.starting, s.running, s.stopping).WithName("modules.service")
	return s
}

func (m *service) WithDependencies(dependencyMap map[string][]string) *service {
	m.dependencyMap = dependencyMap
	return m
}

func (m *service) starting(ctx context.Context) error {
	var err error
	m.moduleManager.SetContext(ctx)
	_, span := infratracing.Start(ctx, "modules.service.starting")
	defer span.End()
	for mod, targets := range m.dependencyMap {
		if !m.moduleManager.IsModuleRegistered(mod) {
			continue
		}
		if err := m.moduleManager.AddDependency(mod, targets...); err != nil {
			return err
		}
	}

	m.serviceMap, err = m.moduleManager.InitModuleServices(m.targets...)
	if err != nil {
		return err
	}

	// if no modules are registered, we don't need to start the service manager
	if len(m.serviceMap) == 0 {
		return nil
	}

	svcs := make([]services.Service, 0, len(m.serviceMap))
	for _, s := range m.serviceMap {
		svcs = append(svcs, s)
	}

	m.serviceManager, err = services.NewManager(svcs...)
	if err != nil {
		return err
	}

	// we don't need to continue if no modules are registered.
	// this behavior may need to change if dskit services replace the
	// current background service registry.
	if len(m.serviceMap) == 0 {
		m.log.Warn("No modules registered...")
		<-ctx.Done()
		return nil
	}

	listener := newServiceListener(m.log, m)
	m.serviceManager.AddListener(listener)
	if err := m.serviceManager.StartAsync(ctx); err != nil {
		return err
	}
	return m.serviceManager.AwaitHealthy(ctx)
}

func (m *service) running(ctx context.Context) error {
	_, span := infratracing.Start(ctx, "modules.service.running")
	defer span.End()

	// If no service manager was created (no modules registered), just wait for context
	if m.serviceManager == nil {
		<-ctx.Done()
		return nil
	}

	stopCtx := context.Background()
	return m.serviceManager.AwaitStopped(stopCtx)
}

func (m *service) stopping(failureReason error) error {
	spanCtx, span := infratracing.Start(context.Background(), "modules.service.stopping")
	defer span.End()
	m.log.Debug("Stopping module service manager", "reason", failureReason)

	// If no service manager was created (no modules registered), nothing to stop
	if m.serviceManager == nil {
		return nil
	}

	m.serviceManager.StopAsync()
	if err := m.serviceManager.AwaitStopped(spanCtx); err != nil {
		m.log.Error("Failed to stop module service manager", "error", err)
		return err
	}

	failed := m.serviceManager.ServicesByState()[services.Failed]
	for _, f := range failed {
		// the service listener will log error details for all modules that failed,
		// so here we return the first error that is not ErrStopProcess
		if !errors.Is(f.FailureCase(), modules.ErrStopProcess) {
			return f.FailureCase()
		}
	}

	return nil
}

// Run starts all registered modules.
func (m *service) Run(ctx context.Context) error {
	spanCtx, span := infratracing.Start(ctx, "modules.service.Run")
	defer span.End()
	if err := m.StartAsync(spanCtx); err != nil {
		return err
	}
	stopCtx := context.Background()
	return m.AwaitTerminated(stopCtx)
}

// Shutdown stops all modules and waits for them to stop.
func (m *service) Shutdown(ctx context.Context, reason string) error {
	spanCtx, span := infratracing.Start(ctx, "modules.service.Shutdown")
	defer span.End()
	m.StopAsync()
	return m.AwaitTerminated(spanCtx)
}

// RegisterModule registers a module with the dskit module manager.
func (m *service) RegisterModule(name string, fn func() (services.Service, error)) {
	m.moduleManager.RegisterModule(name, fn)
}

// RegisterInvisibleModule registers an invisible module with the dskit module manager.
// Invisible modules are not visible to the user, and are intended to be used as dependencies.
func (m *service) RegisterInvisibleModule(name string, fn func() (services.Service, error)) {
	m.moduleManager.RegisterInvisibleModule(name, fn)
}

func (m *service) IsModuleEnabled(name string) bool {
	return stringsContain(m.targets, name)
}
