package modules

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
)

type Engine interface {
	Run(context.Context) error
	Shutdown(context.Context, string) error
}

type Manager interface {
	RegisterModule(name string, fn initFn)
	RegisterInvisibleModule(name string, fn initFn)
}

var _ Engine = (*service)(nil)
var _ Manager = (*service)(nil)

// service manages the registration and lifecycle of modules.
type service struct {
	log     log.Logger
	targets []string

	moduleManager  *modules.Manager
	serviceManager *services.Manager
	serviceMap     map[string]services.Service
}

func New(
	targets []string,
) *service {
	logger := log.New("modules")

	return &service{
		log:     logger,
		targets: targets,

		moduleManager: modules.NewManager(logger),
		serviceMap:    map[string]services.Service{},
	}
}

// Run starts all registered modules.
func (m *service) Run(ctx context.Context) error {
	var err error

	for mod, targets := range dependencyMap {
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

	m.log.Debug("Starting module service manager", "targets", strings.Join(m.targets, ","))
	// wait until a service fails or stop signal was received
	err = m.serviceManager.StartAsync(ctx)
	if err != nil {
		return err
	}

	stopCtx := context.Background()
	if err = m.serviceManager.AwaitStopped(stopCtx); err != nil {
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

// Shutdown stops all modules and waits for them to stop.
func (m *service) Shutdown(ctx context.Context, reason string) error {
	if m.serviceManager == nil {
		m.log.Debug("No modules registered, nothing to stop...")
		return nil
	}
	m.serviceManager.StopAsync()
	m.log.Info("Awaiting services to be stopped...", "reason", reason)
	return m.serviceManager.AwaitStopped(ctx)
}

type initFn func() (services.Service, error)

// RegisterModule registers a module with the dskit module manager.
func (m *service) RegisterModule(name string, fn initFn) {
	m.moduleManager.RegisterModule(name, fn)
}

// RegisterInvisibleModule registers an invisible module with the dskit module manager.
// Invisible modules are not visible to the user, and are intended to be used as dependencies.
func (m *service) RegisterInvisibleModule(name string, fn initFn) {
	m.moduleManager.RegisterModule(name, fn, modules.UserInvisibleModule)
}

// IsModuleEnabled returns true if the module is enabled.
func (m *service) IsModuleEnabled(name string) bool {
	return stringsContain(m.targets, name)
}
