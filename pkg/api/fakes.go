package api

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type fakePluginStore struct {
	plugins map[string]plugins.PluginDTO
}

func (ps fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := ps.plugins[pluginID]

	return p, exists
}

func (ps fakePluginStore) Plugins(_ context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	var result []plugins.PluginDTO
	for _, v := range ps.plugins {
		for _, t := range pluginTypes {
			if v.Type == t {
				result = append(result, v)
			}
		}
	}

	return result
}

func (ps fakePluginStore) Add(_ context.Context, pluginID, version string) error {
	ps.plugins[pluginID] = plugins.PluginDTO{
		JSONData: plugins.JSONData{
			ID: pluginID,
			Info: plugins.Info{
				Version: version,
			},
		},
	}
	return nil
}

func (ps fakePluginStore) Remove(_ context.Context, pluginID string) error {
	delete(ps.plugins, pluginID)
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
