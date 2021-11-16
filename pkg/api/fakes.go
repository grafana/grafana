package api

import "github.com/grafana/grafana/pkg/plugins"

type fakePluginStore struct {
	plugins.Store
}

func (ps *fakePluginStore) Plugin(pluginID string) *plugins.Plugin {
	return nil
}

func (ps *fakePluginStore) Plugins(pluginType ...plugins.Type) []*plugins.Plugin {
	return nil
}

type fakeRendererManager struct {
	plugins.RendererManager
}

func (ps *fakeRendererManager) Renderer() *plugins.Plugin {
	return nil
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.StaticRoute
}

func (psrr *fakePluginStaticRouteResolver) Routes() []*plugins.StaticRoute {
	return psrr.routes
}
