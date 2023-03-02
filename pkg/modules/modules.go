package modules

import (
	"context"
	"errors"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	All string = "all"
)

type Service struct {
	cfg     *setting.Cfg
	log     log.Logger
	targets []string

	ModuleManager  *modules.Manager
	ServiceManager *services.Manager
	ServiceMap     map[string]services.Service
}

func ProvideService(cfg *setting.Cfg) *Service {
	logger := log.New("modules")
	return &Service{
		cfg:           cfg,
		log:           logger,
		targets:       cfg.Target,
		ModuleManager: modules.NewManager(logger),
		ServiceMap:    map[string]services.Service{},
	}
}

func (m *Service) Init(_ context.Context) error {
	var err error

	m.ModuleManager.RegisterModule(All, nil)

	deps := map[string][]string{
		All: {},
	}

	for mod, targets := range deps {
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

func (m *Service) Run(ctx context.Context) error {
	// Init is called here is to make sure that the modules are initialized
	// while this is being registered as a backaground service.
	if err := m.Init(ctx); err != nil {
		return err
	}

	// we don't need to continue if no modules are registered.
	if len(m.ServiceMap) == 0 {
		m.log.Warn("No modules registered...")
		<-ctx.Done()
		return nil
	}

	serviceListener := newServiceListener(m.log, m)
	m.ServiceManager.AddListener(serviceListener)

	// wait until a service fails or stop signal received
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

func (m *Service) Shutdown(ctx context.Context) error {
	if m.ServiceManager == nil {
		return nil
	}
	m.ServiceManager.StopAsync()
	m.log.Info("Awaiting services to be stopped...")
	return m.ServiceManager.AwaitStopped(ctx)
}

func (m *Service) RegisterModule(name string, initFn func() (services.Service, error), deps ...string) error {
	m.ModuleManager.RegisterModule(name, initFn)
	return m.ModuleManager.AddDependency(name, deps...)
}

func (m *Service) RegisterInvisibleModule(name string, initFn func() (services.Service, error), deps ...string) error {
	m.ModuleManager.RegisterModule(name, initFn, modules.UserInvisibleModule)
	return m.ModuleManager.AddDependency(name, deps...)
}

func (m *Service) isModuleEnabled(name string) bool {
	return stringsContain(m.targets, name)
}
