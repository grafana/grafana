package api

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
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

func (pm *fakePluginInstaller) Add(_ context.Context, pluginID, version string, _ plugins.CompatOpts) error {
	pm.plugins[pluginID] = fakePlugin{
		pluginID: pluginID,
		version:  version,
	}
	return nil
}

func (pm *fakePluginInstaller) Remove(_ context.Context, pluginID string) error {
	delete(pm.plugins, pluginID)
	return nil
}

type fakeRendererManager struct {
	plugins.RendererManager
}

func (ps *fakeRendererManager) Renderer(_ context.Context) *plugins.Plugin {
	return nil
}

type fakePluginStaticRouteResolver struct {
	plugins.StaticRouteResolver

	routes []*plugins.StaticRoute
}

func (psrr *fakePluginStaticRouteResolver) Routes() []*plugins.StaticRoute {
	return psrr.routes
}
