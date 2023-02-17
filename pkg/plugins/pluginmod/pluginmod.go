package pluginmod

import (
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/server/modules"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvidePluginsModule(cfg *setting.Cfg, moduleManager *modules.Modules, coreRegistry *coreplugin.Registry,
	internalRegistry *registry.InMemory, pluginClient *client.Decorator) (*PluginsModule, error) {
	m := &PluginsModule{
		cfg:              cfg,
		moduleManager:    moduleManager,
		coreRegistry:     coreRegistry,
		internalRegistry: internalRegistry,
		pluginClient:     pluginClient,
	}

	if err := m.moduleManager.RegisterModule(modules.PluginManagerServer, m.initServer); err != nil {
		return nil, err
	}
	if err := m.moduleManager.RegisterInvisibleModule(modules.PluginManagerClient, m.initClient); err != nil {
		return nil, err
	}
	if err := m.moduleManager.RegisterInvisibleModule(modules.PluginManagement, m.initLocalPluginManagement); err != nil {
		return nil, err
	}
	if err := m.moduleManager.RegisterInvisibleModule(modules.Plugins, nil); err != nil {
		return nil, err
	}

	return m, nil
}

type PluginsModule struct {
	*services.BasicService
	PluginManager

	cfg              *setting.Cfg
	moduleManager    *modules.Modules
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
