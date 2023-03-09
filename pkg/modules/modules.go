package modules

import (
	"context"
	"errors"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// List of available targets.
const (
	All string = "all"
)

type Engine interface {
	Init(context.Context) error
	Run(context.Context) error
	Shutdown(context.Context) error
}

type Manager interface {
	RegisterModule(name string, initFn func() (services.Service, error), deps ...string)
	RegisterInvisibleModule(name string, initFn func() (services.Service, error), deps ...string)
}

var _ Engine = (*service)(nil)
var _ Manager = (*service)(nil)

// service manages the registration and lifecycle of modules.
type service struct {
	cfg           *setting.Cfg
	log           log.Logger
	targets       []string
	dependencyMap map[string][]string

	ModuleManager  *modules.Manager
	ServiceManager *services.Manager
	ServiceMap     map[string]services.Service
}

func ProvideService(cfg *setting.Cfg) *service {
	logger := log.New("modules")

	return &service{
		cfg:           cfg,
		log:           logger,
		targets:       cfg.Target,
		dependencyMap: map[string][]string{},

		ModuleManager: modules.NewManager(logger),
		ServiceMap:    map[string]services.Service{},
	}
}

// Init initializes all registered modules.
func (m *service) Init(_ context.Context) error {
	var err error

	// module registration
	m.RegisterModule(All, nil)

	for mod, targets := range m.dependencyMap {
		if err := m.ModuleManager.AddDependency(mod, targets...); err != nil {
			return err
		}
	}

	m.ServiceMap, err = m.ModuleManager.InitModuleServices(m.targets...)
	if err != nil {
		return err
	}

	// if no modules are registered, we don't need to start the service manager
	if len(m.ServiceMap) == 0 {
		return nil
	}

	var svcs []services.Service
	for _, s := range m.ServiceMap {
		svcs = append(svcs, s)
	}
	m.ServiceManager, err = services.NewManager(svcs...)

	return err
}

// Run starts all registered modules.
func (m *service) Run(ctx context.Context) error {
	// we don't need to continue if no modules are registered.
	// this behavior may need to change if dskit services replace the
	// current background service registry.
	if len(m.ServiceMap) == 0 {
		m.log.Warn("No modules registered...")
		<-ctx.Done()
		return nil
	}

	listener := newServiceListener(m.log, m)
	m.ServiceManager.AddListener(listener)

	// wait until a service fails or stop signal was received
	err := m.ServiceManager.StartAsync(ctx)
	if err != nil {
		return err
	}

	err = m.ServiceManager.AwaitStopped(ctx)
	if err != nil {
		return err
	}

	failed := m.ServiceManager.ServicesByState()[services.Failed]
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
	if m.ServiceManager == nil {
		m.log.Debug("No modules registered, nothing to stop...")
		return nil
	}
	m.ServiceManager.StopAsync()
	m.log.Info("Awaiting services to be stopped...")
	return m.ServiceManager.AwaitStopped(ctx)
}

// RegisterModule registers a module with the dskit module manager.
func (m *service) RegisterModule(name string, initFn func() (services.Service, error), deps ...string) {
	m.ModuleManager.RegisterModule(name, initFn)
	m.dependencyMap[name] = deps
}

// RegisterInvisibleModule registers an invisible module with the dskit module manager.
// Invisible modules are not visible to the user, and are intendent to be used as dependencies.
func (m *service) RegisterInvisibleModule(name string, initFn func() (services.Service, error), deps ...string) {
	m.ModuleManager.RegisterModule(name, initFn, modules.UserInvisibleModule)
	m.dependencyMap[name] = deps
}

// IsModuleEnabled returns true if the module is enabled.
func (m *service) IsModuleEnabled(name string) bool {
	return stringsContain(m.targets, name)
}
