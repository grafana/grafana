package api

import "github.com/grafana/grafana/pkg/plugins"

type fakePluginStore struct {
	plugins.Store
}

func (pr *fakePluginStore) Plugin(pluginID string) *plugins.PluginV2 {
	return nil
}

// Plugins returns plugins by their requested type.
func (pr *fakePluginStore) Plugins(pluginType ...plugins.PluginType) []*plugins.PluginV2 {
	return nil
}

// Renderer returns a renderer plugin.
func (pr *fakePluginStore) Renderer() *plugins.PluginV2 {
	return nil
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.PluginStaticRoute
}

func (pr *fakePluginStaticRouteResolver) StaticRoutes() []*plugins.PluginStaticRoute {
	return pr.routes
}
