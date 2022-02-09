package api

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

type fakePluginStore struct {
	plugins.Store

	plugins map[string]plugins.PluginDTO
}

func (pr fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := pr.plugins[pluginID]

	return p, exists
}

func (pr fakePluginStore) Plugins(_ context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	var result []plugins.PluginDTO
	for _, v := range pr.plugins {
		for _, t := range pluginTypes {
			if v.Type == t {
				result = append(result, v)
			}
		}
	}

	return result
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
