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
	All           string = "all"
	Core          string = "core"
	HTTPServer    string = "http-server"
	AccessControl string = "access-control"

	Plugins             string = "plugins"
	PluginManagerServer string = "plugins-server"
	PluginManagerClient string = "plugins-client"
	PluginManagement    string = "plugin-management"
)

type Modules struct {
	targets []string
	cfg     *setting.Cfg
	log     log.Logger

	moduleManager  *modules.Manager
	serviceManager *services.Manager
	serviceMap     map[string]services.Service
	deps           map[string][]string
}

type Engine interface {
	Init(context.Context) error
	Run(context.Context) error
	Shutdown(context.Context) error
}

type Manager interface {
	RegisterModule(name string, initFn func() (services.Service, error), deps ...string) error
	RegisterInvisibleModule(name string, initFn func() (services.Service, error), deps ...string) error
}

func ProvideService(cfg *setting.Cfg) *Modules {
	logger := log.New("modules")
	return &Modules{
		targets:       cfg.Target,
		cfg:           cfg,
		log:           logger,
		moduleManager: modules.NewManager(logger),
	}
}

func (m *Modules) Init(_ context.Context) error {
	m.moduleManager.RegisterModule(All, nil)

	deps := map[string][]string{
		PluginManagerServer: {},
		PluginManagerClient: {},
		PluginManagement:    {},
		Plugins:             {},

		AccessControl: {},
		Core:          {AccessControl, Plugins},
		HTTPServer:    {Core, Plugins},
		All:           {Core, HTTPServer, AccessControl, Plugins},
	}

	if m.isModuleEnabled(All) {
		deps[Plugins] = append(deps[Plugins], PluginManagement)
	} else {
		deps[Plugins] = append(deps[Plugins], PluginManagerClient)
	}

	for mod, targets := range deps {
		if err := m.moduleManager.AddDependency(mod, targets...); err != nil {
			return err
		}
	}

	m.deps = deps

	return nil
}

func (m *Modules) Run(ctx context.Context) error {
	serviceMap, err := m.moduleManager.InitModuleServices(m.targets...)
	if err != nil {
		return err
	}
	m.serviceMap = serviceMap

	var svcs []services.Service
	for _, s := range serviceMap {
		svcs = append(svcs, s)
	}

	sm, err := services.NewManager(svcs...)
	if err != nil {
		return err
	}

	m.serviceManager = sm

	healthy := func() { m.log.Info("Modules started") }
	stopped := func() { m.log.Info("Modules stopped") }
	serviceFailed := func(service services.Service) {
		// if any service fails, stop all services
		sm.StopAsync()

		// log which module failed
		for module, s := range serviceMap {
			if s == service {
				if errors.Is(service.FailureCase(), modules.ErrStopProcess) {
					m.log.Info("Received stop signal via return error", "module", module, "err", service.FailureCase())
				} else {
					m.log.Error("Module failed", "module", module, "err", service.FailureCase())
				}
				return
			}
		}

		m.log.Error("Module failed", "module", "unknown", "err", service.FailureCase())
	}

	sm.AddListener(services.NewManagerListener(healthy, stopped, serviceFailed))

	// wait until a service fails or stop signal received
	err = sm.StartAsync(ctx)
	if err == nil {
		err = sm.AwaitStopped(ctx)
	}

	if err == nil {
		if failed := sm.ServicesByState()[services.Failed]; len(failed) > 0 {
			for _, f := range failed {
				if !errors.Is(f.FailureCase(), modules.ErrStopProcess) {
					// Details were reported via failure listener before
					err = f.FailureCase()
					break
				}
			}
		}
	}

	return err
}

func (m *Modules) Shutdown(ctx context.Context) error {
	if m.serviceManager != nil {
		m.serviceManager.StopAsync()

		m.log.Info("Awaiting services to be stopped")
		err := m.serviceManager.AwaitStopped(ctx)
		if err != nil {
			return err
		}
		return nil
	}
	return nil
}

func (m *Modules) isModuleEnabled(name string) bool {
	return stringsContain(m.targets, name)
}

func stringsContain(values []string, search string) bool {
	for _, v := range values {
		if search == v {
			return true
		}
	}

	return false
}

func (m *Modules) RegisterModule(name string, initFn func() (services.Service, error), deps ...string) error {
	m.moduleManager.RegisterModule(name, initFn)
	err := m.moduleManager.AddDependency(name, deps...)
	if err != nil {
		return err
	}
	return nil
}

func (m *Modules) RegisterInvisibleModule(name string, initFn func() (services.Service, error), deps ...string) error {
	m.moduleManager.RegisterModule(name, initFn, modules.UserInvisibleModule)
	err := m.moduleManager.AddDependency(name, deps...)
	if err != nil {
		return err
	}
	return nil
}
