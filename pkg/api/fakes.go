package api

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/rendering"
)

type fakePluginInstaller struct {
	plugins.Installer

	plugins map[string]fakePlugin
}

type fakePlugin struct {
	pluginID string
	version  string
}

func NewFakePluginInstaller() *fakePluginInstaller {
	return &fakePluginInstaller{plugins: map[string]fakePlugin{}}
}

func (pm *fakePluginInstaller) Add(_ context.Context, pluginID, version string, _ plugins.AddOpts) error {
	pm.plugins[pluginID] = fakePlugin{
		pluginID: pluginID,
		version:  version,
	}
	return nil
}

func (pm *fakePluginInstaller) Remove(_ context.Context, pluginID, _ string) error {
	delete(pm.plugins, pluginID)
	return nil
}

type fakeRendererPluginManager struct {
	rendering.PluginManager
}

func (ps *fakeRendererPluginManager) Renderer(_ context.Context) (rendering.Plugin, bool) {
	return nil, false
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.StaticRoute
}

func (psrr *fakePluginStaticRouteResolver) Routes(_ context.Context) []*plugins.StaticRoute {
	return psrr.routes
}
