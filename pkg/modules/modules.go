package modules

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	infratracing "github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/modules/tracing"
)

const listenerDrainTimeout = 2 * time.Second

type Engine interface {
	Run(context.Context) error
	Shutdown(context.Context, string) error
}

type Registry interface {
	RegisterModule(name string, fn func() (services.Service, error))
	RegisterInvisibleModule(name string, fn func() (services.Service, error))
}

type Manager interface {
	services.NamedService
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

	shutdownMu    sync.Mutex
	shutdownBegun bool
	shutdownSpan  trace.Span
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
	spanCtx, span := infratracing.Start(ctx, "modules.service.starting")
	defer span.End()
	// spanCtx, not ctx: listeners parent their spans on this.
	m.moduleManager.SetContext(spanCtx)
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
	if err := m.serviceManager.StartAsync(spanCtx); err != nil {
		return err
	}
	if err := m.serviceManager.AwaitHealthy(spanCtx); err != nil {
		m.serviceManager.StopAsync()
		stopErr := m.serviceManager.AwaitStopped(context.Background())
		// dskit skips stoppingFn when startingFn fails, so drain here instead.
		m.drainListeners(spanCtx)
		if failure := m.firstServiceManagerFailure(); failure != nil {
			return failure
		}
		if stopErr != nil {
			return errors.Join(err, stopErr)
		}
		return err
	}
	return nil
}

// running is not traced: it lasts as long as the process, so its span would only
// be exported at exit.
func (m *service) running(ctx context.Context) error {
	// If no service manager was created (no modules registered), just wait for context
	if m.serviceManager == nil {
		<-ctx.Done()
		return nil
	}

	stopCtx := context.Background()
	return m.serviceManager.AwaitStopped(stopCtx)
}

func (m *service) stopping(failureReason error) error {
	// Deferred first so it runs last, after the spans nested inside it.
	defer m.endShutdownSpan()

	spanCtx, span := infratracing.StartRoot(m.moduleManager.ShutdownContext(), "modules.service.stopping")
	defer span.End()
	defer m.drainListeners(spanCtx)
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

	return m.firstServiceManagerFailure()
}

// drainListeners waits for the listeners to close their spans. Its deadline is
// independent of ctx, which is usually already spent by this point.
func (m *service) drainListeners(ctx context.Context) {
	waitCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), listenerDrainTimeout)
	defer cancel()
	m.moduleManager.WaitForListeners(waitCtx)
}

// beginShutdown opens the root of the shutdown trace, which stopping closes. It has
// to run before anything triggers the shutdown, or services reaching Stopping first
// start their own trace. Only the first call opens a span.
func (m *service) beginShutdown(ctx context.Context) context.Context {
	m.shutdownMu.Lock()
	defer m.shutdownMu.Unlock()

	if m.shutdownBegun {
		return m.moduleManager.ShutdownContext()
	}
	m.shutdownBegun = true

	spanCtx, span := infratracing.StartRoot(ctx, "server.Shutdown")
	m.shutdownSpan = span
	m.moduleManager.SetShutdownContext(spanCtx)
	return spanCtx
}

// endShutdownSpan closes the shutdown trace. Idempotent, so callers can use it as a
// fallback for paths that skip stopping.
func (m *service) endShutdownSpan() {
	m.shutdownMu.Lock()
	span := m.shutdownSpan
	m.shutdownSpan = nil
	m.shutdownMu.Unlock()

	if span != nil {
		span.End()
	}
}

func (m *service) firstServiceManagerFailure() error {
	failed := m.serviceManager.ServicesByState()[services.Failed]
	for _, f := range failed {
		// The service listener logs error details for all failed modules, so here we return
		// the first error that is not an expected shutdown signal.
		cause := f.FailureCase()
		if errors.Is(cause, modules.ErrStopProcess) || errors.Is(cause, context.Canceled) {
			continue
		}
		return cause
	}

	return nil
}

// Run starts all registered modules.
func (m *service) Run(ctx context.Context) error {
	// Closed once the modules are running: a process-lifetime span would only be
	// exported at exit, leaving its trace rootless.
	startupCtx, startupSpan := infratracing.StartRoot(ctx, "modules.service.startup")
	if err := m.StartAsync(startupCtx); err != nil {
		_ = infratracing.Error(startupSpan, err)
		startupSpan.End()
		return err
	}
	// Not returned: AwaitTerminated below surfaces any failure, so a shutdown
	// landing mid-startup stays a clean stop.
	if err := m.AwaitRunning(startupCtx); err != nil {
		_ = infratracing.Error(startupSpan, err)
	}
	startupSpan.End()

	stopCtx := context.Background()
	return m.AwaitTerminated(stopCtx)
}

// Shutdown stops all modules and waits for them to stop. Callers must trigger the
// shutdown through here rather than by cancelling the context they passed to Run, so
// that the shutdown trace is in place before any service enters Stopping.
func (m *service) Shutdown(ctx context.Context, reason string) error {
	spanCtx := m.beginShutdown(ctx)
	m.StopAsync()
	err := m.AwaitTerminated(spanCtx)
	// Fallback for the startup-failure path, where stopping does not run.
	m.endShutdownSpan()
	return err
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
