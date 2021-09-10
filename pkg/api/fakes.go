package api

import "github.com/grafana/grafana/pkg/plugins"

type fakePluginResolver struct {
	plugins.Resolver
}

func (pr *fakePluginResolver) Plugin(pluginID string) *plugins.PluginV2 {
	return nil
}

// Plugins returns plugins by their requested type.
func (pr *fakePluginResolver) Plugins(pluginType ...plugins.PluginType) []*plugins.PluginV2 {
	return nil
}

// Renderer returns a renderer plugin.
func (pr *fakePluginResolver) Renderer() *plugins.PluginV2 {
	return nil
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.PluginStaticRoute
}

func (pr *fakePluginStaticRouteResolver) StaticRoutes() []*plugins.PluginStaticRoute {
	return pr.routes
}
