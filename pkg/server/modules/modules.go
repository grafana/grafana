package modules

import (
	"context"
	"errors"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/pluginmod"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
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
	moduleManager  *modules.Manager
	serviceManager *services.Manager
	targets        []string
	cfg            *setting.Cfg
	log            log.Logger

	httpServer         *api.HTTPServer
	backgroundServices *backgroundsvcs.BackgroundServiceRegistry
	accessControl      *acimpl.Service
	plugins            *pluginmod.PluginsModule
}

type Engine interface {
	Init(context.Context) error
	Run(context.Context) error
	Shutdown(context.Context) error
}

func ProvideService(cfg *setting.Cfg, httpServer *api.HTTPServer, accessControl *acimpl.Service,
	backgroundServices *backgroundsvcs.BackgroundServiceRegistry, plugins *pluginmod.PluginsModule) *Modules {
	logger := log.New("modules")
	return &Modules{
		targets:            cfg.Target,
		cfg:                cfg,
		log:                logger,
		moduleManager:      modules.NewManager(logger),
		httpServer:         httpServer,
		backgroundServices: backgroundServices,
		accessControl:      accessControl,
		plugins:            plugins,
	}
}

func (m *Modules) Init(_ context.Context) error {
	m.moduleManager.RegisterModule(PluginManagerServer, m.initPluginManagerServer)
	m.moduleManager.RegisterModule(PluginManagerClient, m.initPluginManagerClient, modules.UserInvisibleModule)
	m.moduleManager.RegisterModule(PluginManagement, m.initPluginManagement, modules.UserInvisibleModule)
	m.moduleManager.RegisterModule(Plugins, nil, modules.UserInvisibleModule)
	m.moduleManager.RegisterModule(AccessControl, m.initAccessControl)
	m.moduleManager.RegisterModule(HTTPServer, m.initHTTPServer)
	m.moduleManager.RegisterModule(Core, m.initBackgroundServices)
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

	return nil
}

func (m *Modules) Run(ctx context.Context) error {
	serviceMap, err := m.moduleManager.InitModuleServices(m.targets...)
	if err != nil {
		return err
	}

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

func (m *Modules) initHTTPServer() (services.Service, error) {
	return m.httpServer, nil
}

func (m *Modules) initAccessControl() (services.Service, error) {
	return m.accessControl, nil
}

func (m *Modules) initBackgroundServices() (services.Service, error) {
	return m.backgroundServices, nil
}

func (m *Modules) initPluginManagerServer() (services.Service, error) {
	return m.plugins.InitServer()
}

func (m *Modules) initPluginManagerClient() (services.Service, error) {
	return m.plugins.InitClient()
}

func (m *Modules) initPluginManagement() (services.Service, error) {
	return m.plugins.InitPluginManagement()
}
