package modules

import (
	"context"
	"errors"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

type Engine interface {
	Init(context.Context) error
	Run(context.Context) error
	Shutdown(context.Context) error
}

type Manager interface {
	RegisterModule(name string, initFn func() (services.Service, error))
	RegisterInvisibleModule(name string, initFn func() (services.Service, error))
}

var _ Engine = (*service)(nil)
var _ Manager = (*service)(nil)

// service manages the registration and lifecycle of modules.
type service struct {
	cfg     *setting.Cfg
	log     log.Logger
	targets []string

	moduleManager  *modules.Manager
	serviceManager *services.Manager
	serviceMap     map[string]services.Service
}

func ProvideService(cfg *setting.Cfg) *service {
	logger := log.New("modules")

	return &service{
		cfg:     cfg,
		log:     logger,
		targets: cfg.Target,

		moduleManager: modules.NewManager(logger),
		serviceMap:    map[string]services.Service{},
	}
}

// Init initializes all registered modules.
func (m *service) Init(_ context.Context) error {
	var err error

	for mod, targets := range dependencyMap {
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

	var svcs []services.Service
	for _, s := range m.serviceMap {
		svcs = append(svcs, s)
	}
	m.serviceManager, err = services.NewManager(svcs...)

	return err
}

// Run starts all registered modules.
func (m *service) Run(ctx context.Context) error {
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

	// wait until a service fails or stop signal was received
	err := m.serviceManager.StartAsync(ctx)
	if err != nil {
		return err
	}

	err = m.serviceManager.AwaitStopped(ctx)
	if err != nil {
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
func (m *service) Shutdown(ctx context.Context) error {
	if m.serviceManager == nil {
		m.log.Debug("No modules registered, nothing to stop...")
		return nil
	}
	m.serviceManager.StopAsync()
	m.log.Info("Awaiting services to be stopped...")
	return m.serviceManager.AwaitStopped(ctx)
}

// RegisterModule registers a module with the dskit module manager.
func (m *service) RegisterModule(name string, initFn func() (services.Service, error)) {
	m.moduleManager.RegisterModule(name, initFn)
}

// RegisterInvisibleModule registers an invisible module with the dskit module manager.
// Invisible modules are not visible to the user, and are intended to be used as dependencies.
func (m *service) RegisterInvisibleModule(name string, initFn func() (services.Service, error)) {
	m.moduleManager.RegisterModule(name, initFn, modules.UserInvisibleModule)
}

// IsModuleEnabled returns true if the module is enabled.
func (m *service) IsModuleEnabled(name string) bool {
	return stringsContain(m.targets, name)
}
