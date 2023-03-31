package pluginmod

import (
	"context"
	"errors"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/client"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/setting"
)

var errPluginManagerUnavailable = errors.New("plugins unavailable")

func ProvidePluginsModule(cfg *setting.Cfg, moduleManager modules.Manager, coreRegistry *coreplugin.Registry,
	internalRegistry *registry.InMemory, pluginClient *client.Decorator,
	grpcServerProvider grpcserver.Provider) (*PluginsModule, error) {
	m := &PluginsModule{
		cfg:                cfg,
		coreRegistry:       coreRegistry,
		internalRegistry:   internalRegistry,
		pluginClient:       pluginClient,
		grpcServerProvider: grpcServerProvider,
	}

	moduleManager.RegisterModule(modules.PluginManagerServer, m.initServer, modules.GRPCServer)
	moduleManager.RegisterInvisibleModule(modules.PluginManagerClient, m.initClient)
	moduleManager.RegisterInvisibleModule(modules.PluginManagement, m.initLocalPluginManagement)

	if moduleManager.IsModuleEnabled(modules.PluginManagerServer) {
		moduleManager.RegisterInvisibleModule(modules.Plugins, nil)
	} else if moduleManager.IsModuleEnabled(modules.PluginManagerClient) {
		moduleManager.RegisterInvisibleModule(modules.Plugins, nil, modules.PluginManagerClient)
	} else {
		moduleManager.RegisterInvisibleModule(modules.Plugins, nil, modules.PluginManagement)
	}

	return m, nil
}

type PluginsModule struct {
	pm                 PluginManager
	cfg                *setting.Cfg
	coreRegistry       *coreplugin.Registry
	internalRegistry   *registry.InMemory
	pluginClient       *client.Decorator
	grpcServerProvider grpcserver.Provider
}

func (m *PluginsModule) initServer() (services.Service, error) {
	return newPluginManagerServer(m.cfg, m.coreRegistry, m.internalRegistry, m.pluginClient, m.grpcServerProvider)
}

func (m *PluginsModule) initClient() (services.Service, error) {
	c := newPluginManagerClient(m.cfg)
	m.registerPluginManager(c)

	return c, nil
}

func (m *PluginsModule) initLocalPluginManagement() (services.Service, error) {
	c, err := NewCore(m.cfg, m.coreRegistry, m.internalRegistry, m.pluginClient)
	if err != nil {
		return nil, err
	}
	m.registerPluginManager(c)

	return c, nil
}

func (m *PluginsModule) registerPluginManager(pm PluginManager) {
	m.pm = pm
}

func (m *PluginsModule) manager() (PluginManager, bool) {
	if m.pm != nil {
		return m.pm, true
	}
	return nil, false
}

func (m *PluginsModule) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	if pm, exists := m.manager(); exists {
		return pm.Add(ctx, pluginID, version, opts)
	}
	return errPluginManagerUnavailable
}

func (m *PluginsModule) Remove(ctx context.Context, pluginID string) error {
	if pm, exists := m.manager(); exists {
		return pm.Remove(ctx, pluginID)
	}
	return errPluginManagerUnavailable
}

func (m *PluginsModule) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	if pm, exists := m.manager(); exists {
		return pm.Plugin(ctx, pluginID)
	}
	return plugins.PluginDTO{}, false
}

func (m *PluginsModule) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	if pm, exists := m.manager(); exists {
		return pm.Plugins(ctx, pluginTypes...)
	}
	return []plugins.PluginDTO{}
}

func (m *PluginsModule) Renderer(ctx context.Context) *plugins.Plugin {
	if pm, exists := m.manager(); exists {
		return pm.Renderer(ctx)
	}
	return nil
}

func (m *PluginsModule) SecretsManager(ctx context.Context) *plugins.Plugin {
	if pm, exists := m.manager(); exists {
		return pm.SecretsManager(ctx)
	}
	return nil
}

func (m *PluginsModule) Routes() []*plugins.StaticRoute {
	if pm, exists := m.manager(); exists {
		return pm.Routes()
	}
	return []*plugins.StaticRoute{}
}

func (m *PluginsModule) PluginErrors() []*plugins.Error {
	if pm, exists := m.manager(); exists {
		return pm.PluginErrors()
	}
	return []*plugins.Error{}
}

func (m *PluginsModule) File(ctx context.Context, pluginID, filename string) (*plugins.File, error) {
	if pm, exists := m.manager(); exists {
		return pm.File(ctx, pluginID, filename)
	}
	return &plugins.File{}, nil
}

func (m *PluginsModule) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pm, exists := m.manager(); exists {
		return pm.QueryData(ctx, req)
	}
	return nil, errPluginManagerUnavailable
}

func (m *PluginsModule) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if pm, exists := m.manager(); exists {
		return pm.CallResource(ctx, req, sender)
	}
	return errPluginManagerUnavailable
}

func (m *PluginsModule) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if pm, exists := m.manager(); exists {
		return pm.CheckHealth(ctx, req)
	}
	return nil, errPluginManagerUnavailable
}

func (m *PluginsModule) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if pm, exists := m.manager(); exists {
		return pm.CollectMetrics(ctx, req)
	}
	return nil, errPluginManagerUnavailable
}

func (m *PluginsModule) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if pm, exists := m.manager(); exists {
		return pm.SubscribeStream(ctx, req)
	}
	return nil, errPluginManagerUnavailable
}

func (m *PluginsModule) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if pm, exists := m.manager(); exists {
		return pm.PublishStream(ctx, req)
	}
	return nil, errPluginManagerUnavailable
}

func (m *PluginsModule) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if pm, exists := m.manager(); exists {
		return pm.RunStream(ctx, req, sender)
	}
	return errPluginManagerUnavailable
}
