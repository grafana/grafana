package pluginmod

import (
	"github.com/grafana/dskit/services"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvidePluginsModule(cfg *setting.Cfg, coreRegistry *coreplugin.Registry, internalRegistry *registry.InMemory,
	pluginClient *client.Decorator) (*PluginsModule, error) {
	m := &PluginsModule{
		cfg:              cfg,
		coreRegistry:     coreRegistry,
		internalRegistry: internalRegistry,
		pluginClient:     pluginClient,
	}

	return m, nil
}

type PluginsModule struct {
	PluginManager

	cfg              *setting.Cfg
	coreRegistry     *coreplugin.Registry
	internalRegistry *registry.InMemory
	pluginClient     *client.Decorator
}

func (m *PluginsModule) InitServer() (services.Service, error) {
	return NewServer(), nil
}

func (m *PluginsModule) InitClient() (services.Service, error) {
	c := NewClient()
	m.registerPluginManager(c)

	return c, nil
}

func (m *PluginsModule) InitPluginManagement() (services.Service, error) {
	c := NewCore(m.cfg, m.coreRegistry, m.internalRegistry, m.pluginClient)
	m.registerPluginManager(c)

	return c, nil
}

func (m *PluginsModule) registerPluginManager(pm PluginManager) {
	m.PluginManager = pm
}
