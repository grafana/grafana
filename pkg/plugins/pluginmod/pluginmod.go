package pluginmod

import (
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvidePluginsModule(cfg *setting.Cfg, moduleManager modules.Manager, coreRegistry *coreplugin.Registry,
	internalRegistry *registry.InMemory, pluginClient *client.Decorator) (*PluginsModule, error) {
	m := &PluginsModule{
		cfg:              cfg,
		coreRegistry:     coreRegistry,
		internalRegistry: internalRegistry,
		pluginClient:     pluginClient,
	}

	moduleManager.RegisterModule(modules.PluginManagerServer, m.initServer)
	moduleManager.RegisterInvisibleModule(modules.PluginManagerClient, m.initClient)
	moduleManager.RegisterInvisibleModule(modules.PluginManagement, m.initLocalPluginManagement)

	if moduleManager.IsModuleEnabled(modules.All) {
		moduleManager.RegisterInvisibleModule(modules.Plugins, nil, modules.PluginManagement)
	} else {
		moduleManager.RegisterInvisibleModule(modules.Plugins, nil, modules.PluginManagerClient)
	}

	return m, nil
}

type PluginsModule struct {
	*services.BasicService
	PluginManager

	cfg              *setting.Cfg
	coreRegistry     *coreplugin.Registry
	internalRegistry *registry.InMemory
	pluginClient     *client.Decorator
}

func (m *PluginsModule) initServer() (services.Service, error) {
	return NewServer(), nil
}

func (m *PluginsModule) initClient() (services.Service, error) {
	c := NewClient()
	m.registerPluginManager(c)

	return c, nil
}

func (m *PluginsModule) initLocalPluginManagement() (services.Service, error) {
	c := NewCore(m.cfg, m.coreRegistry, m.internalRegistry, m.pluginClient)
	m.registerPluginManager(c)

	return c, nil
}

func (m *PluginsModule) registerPluginManager(pm PluginManager) {
	m.PluginManager = pm
}
