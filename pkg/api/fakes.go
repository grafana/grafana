package api

import "github.com/grafana/grafana/pkg/plugins"

type fakePluginManager struct {
	plugins.Manager

	staticRoutes []*plugins.PluginStaticRoute
}

func (pm *fakePluginManager) GetPlugin(id string) *plugins.PluginBase {
	return nil
}

func (pm *fakePluginManager) GetDataSource(id string) *plugins.DataSourcePlugin {
	return nil
}

func (pm *fakePluginManager) Renderer() *plugins.RendererPlugin {
	return nil
}

func (pm *fakePluginManager) StaticRoutes() []*plugins.PluginStaticRoute {
	return pm.staticRoutes
}
