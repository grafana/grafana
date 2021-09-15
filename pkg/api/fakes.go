package api

import "github.com/grafana/grafana/pkg/plugins"

type fakePluginStore struct {
	plugins.Store
}

func (pr *fakePluginStore) Plugin(pluginID string) *plugins.Plugin {
	return nil
}

func (pr *fakePluginStore) Plugins(pluginType ...plugins.PluginType) []*plugins.Plugin {
	return nil
}

func (pr *fakePluginStore) Renderer() *plugins.Plugin {
	return nil
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.PluginStaticRoute
}

func (pr *fakePluginStaticRouteResolver) Routes() []*plugins.PluginStaticRoute {
	return pr.routes
}
