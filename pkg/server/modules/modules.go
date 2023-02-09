package modules

import (
	"context"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/pluginmod"
	"github.com/grafana/grafana/pkg/server/backgroundsvcs"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	All                 string = "all"
	Core                string = "core"
	AccessControl       string = "access-control"
	Plugins             string = "plugins"
	PluginManagerServer string = "plugins-server"
	PluginManagerClient string = "plugins-client"
	PluginManagement    string = "plugin-management"
	HTTPServer          string = "http-server"
)

type Modules struct {
	targets []string
	cfg     *setting.Cfg
	log     log.Logger

	ModuleManager  *modules.Manager
	ServiceManager *services.Manager
	serviceMap     map[string]services.Service
	deps           map[string][]string

	ac                        *acimpl.Service
	backgroundServiceRegistry *backgroundsvcs.BackgroundServiceRegistry
}

func ProvideService(cfg *setting.Cfg, ac *acimpl.Service, backgroundServiceRegistry *backgroundsvcs.BackgroundServiceRegistry) *Modules {
	m := &Modules{
		targets:                   cfg.Target,
		cfg:                       cfg,
		ac:                        ac,
		log:                       log.New("modules"),
		backgroundServiceRegistry: backgroundServiceRegistry,
	}

	m.ModuleManager = modules.NewManager(m.log)

	m.ModuleManager.RegisterModule(Core, m.initBackgroundServices)
	return m
}

func (m *Modules) Init() error {
	//mm.RegisterModule(PluginManagerServer, m.initServer)
	//mm.RegisterModule(PluginManagerClient, m.initClient, modules.UserInvisibleModule)
	//mm.RegisterModule(PluginManagement, m.initLocalPluginManagement, modules.UserInvisibleModule)
	//mm.RegisterModule(Plugins, nil, modules.UserInvisibleModule)
	//mm.RegisterModule(HTTPServer, m.initHTTPServer)
	//mm.RegisterModule(Core, m.initBackgroundServices)
	//mm.RegisterModule(AccessControl, m.initAccessControl)
	m.ModuleManager.RegisterModule(All, nil)

	deps := map[string][]string{
		//AccessControl:       {},
		//PluginManagerServer: {},
		//PluginManagerClient: {},
		//PluginManagement:    {},
		//Plugins:             {},
		//Core:                {AccessControl},
		All: {Core, HTTPServer}, //Plugins
	}

	//if m.isModuleEnabled(All) {
	//	deps[Plugins] = append(deps[Plugins], PluginManagement)
	//} else {
	//	deps[Plugins] = append(deps[Plugins], PluginManagerClient)
	//}

	for mod, targets := range deps {
		if err := m.ModuleManager.AddDependency(mod, targets...); err != nil {
			return err
		}
	}

	m.deps = deps

	return nil
}

func (m *Modules) Run() error {
	m.log.Info("Initializing modules...")
	serviceMap, err := m.ModuleManager.InitModuleServices(m.targets...)
	if err != nil {
		return err
	}
	m.serviceMap = serviceMap

	var svcs []services.Service
	var svcNames []string
	for key, s := range serviceMap {
		svcNames = append(svcNames, key)
		svcs = append(svcs, s)
	}

	m.log.Info("Starting services", "services", svcNames)
	sm, err := services.NewManager(svcs...)
	if err != nil {
		return err
	}

	m.ServiceManager = sm

	healthy := func() { m.log.Info("Modules started") }
	stopped := func() { m.log.Info("Modules stopped") }
	serviceFailed := func(service services.Service) {
		// if any service fails, stop all services
		sm.StopAsync()

		// log which module failed
		for module, s := range serviceMap {
			if s == service {
				if service.FailureCase() == modules.ErrStopProcess {
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
	ctx := context.Background()
	err = sm.StartAsync(ctx)
	if err == nil {
		err = sm.AwaitStopped(ctx)
	}

	if err == nil {
		if failed := sm.ServicesByState()[services.Failed]; len(failed) > 0 {
			for _, f := range failed {
				if f.FailureCase() != modules.ErrStopProcess {
					// Details were reported via failure listener before
					err = f.FailureCase()
					break
				}
			}
		}
	}

	return err
}

func (m *Modules) Stop() error {
	if m.ServiceManager != nil {
		m.ServiceManager.StopAsync()
		return m.ServiceManager.AwaitStopped(context.Background())
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

func (m *Modules) RegisterService(s services.Service) {

}

//func (m *Modules) initHTTPServer() (services.Service, error) {
//	return m.httpServer, nil
//}

func (m *Modules) initBackgroundServices() (services.Service, error) {
	return m.backgroundServiceRegistry, nil
}

func (m *Modules) initAccessControl() (services.Service, error) {
	return m.ac, nil
}

func (m *Modules) initServer() (services.Service, error) {
	return pluginmod.NewServer(), nil
}

func (m *Modules) initLocalPluginManagement() (services.Service, error) {
	c := pluginmod.NewCore(m.cfg)
	pluginmod.RegisterPluginsService(c)

	return c, nil
}

func (m *Modules) initClient() (services.Service, error) {
	c := pluginmod.NewClient()
	pluginmod.RegisterPluginsService(c)

	return c, nil
}

func (m *Modules) PluginInstaller() plugins.Installer {
	return pluginmod.GetPluginsService()
}

func (m *Modules) RegisterModule(name string, initFn func() (services.Service, error), deps ...string) error {
	m.ModuleManager.RegisterModule(name, initFn)
	err := m.ModuleManager.AddDependency(name, deps...)
	if err != nil {
		return err
	}
	return nil
}
