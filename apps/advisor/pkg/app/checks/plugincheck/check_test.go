package plugincheck

import (
	"context"
	"testing"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/managedplugins"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugininstaller"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/stretchr/testify/assert"
)

func TestRun(t *testing.T) {
	tests := []struct {
		name               string
		plugins            []pluginstore.Plugin
		pluginInfo         map[string]*repo.PluginInfo
		pluginArchives     map[string]*repo.PluginArchiveInfo
		pluginPreinstalled []string
		pluginManaged      []string
		expectedErrors     []advisor.CheckV0alpha1StatusReportErrors
	}{
		{
			name:           "No plugins",
			plugins:        []pluginstore.Plugin{},
			expectedErrors: []advisor.CheckV0alpha1StatusReportErrors{},
		},
		{
			name: "Deprecated plugin",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin1", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: map[string]*repo.PluginInfo{
				"plugin1": {Status: "deprecated"},
			},
			pluginArchives: map[string]*repo.PluginArchiveInfo{
				"plugin1": {Version: "1.0.0"},
			},
			expectedErrors: []advisor.CheckV0alpha1StatusReportErrors{
				{
					Severity: advisor.CheckStatusSeverityHigh,
					Reason:   "Plugin deprecated: plugin1",
					Action:   "Look for alternatives",
				},
			},
		},
		{
			name: "Plugin with update",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin2", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: map[string]*repo.PluginInfo{
				"plugin2": {Status: "active"},
			},
			pluginArchives: map[string]*repo.PluginArchiveInfo{
				"plugin2": {Version: "1.1.0"},
			},
			expectedErrors: []advisor.CheckV0alpha1StatusReportErrors{
				{
					Severity: advisor.CheckStatusSeverityLow,
					Reason:   "New version available: plugin2",
					Action:   "Update plugin",
				},
			},
		},
		{
			name: "Plugin with update (non semver)",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin2", Info: plugins.Info{Version: "alpha"}}},
			},
			pluginInfo: map[string]*repo.PluginInfo{
				"plugin2": {Status: "active"},
			},
			pluginArchives: map[string]*repo.PluginArchiveInfo{
				"plugin2": {Version: "beta"},
			},
			expectedErrors: []advisor.CheckV0alpha1StatusReportErrors{
				{
					Severity: advisor.CheckStatusSeverityLow,
					Reason:   "New version available: plugin2",
					Action:   "Update plugin",
				},
			},
		},
		{
			name: "Plugin pinned",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin3", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: map[string]*repo.PluginInfo{
				"plugin3": {Status: "active"},
			},
			pluginArchives: map[string]*repo.PluginArchiveInfo{
				"plugin3": {Version: "1.1.0"},
			},
			pluginPreinstalled: []string{"plugin3"},
			expectedErrors:     []advisor.CheckV0alpha1StatusReportErrors{},
		},
		{
			name: "Managed plugin",
			plugins: []pluginstore.Plugin{
				{JSONData: plugins.JSONData{ID: "plugin4", Info: plugins.Info{Version: "1.0.0"}}},
			},
			pluginInfo: map[string]*repo.PluginInfo{
				"plugin4": {Status: "active"},
			},
			pluginArchives: map[string]*repo.PluginArchiveInfo{
				"plugin4": {Version: "1.1.0"},
			},
			pluginManaged:  []string{"plugin4"},
			expectedErrors: []advisor.CheckV0alpha1StatusReportErrors{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pluginStore := &mockPluginStore{plugins: tt.plugins}
			pluginRepo := &mockPluginRepo{
				pluginInfo:        tt.pluginInfo,
				pluginArchiveInfo: tt.pluginArchives,
			}
			pluginPreinstall := &mockPluginPreinstall{pinned: tt.pluginPreinstalled}
			managedPlugins := &mockManagedPlugins{managed: tt.pluginManaged}
			check := New(pluginStore, pluginRepo, pluginPreinstall, managedPlugins)

			report, err := check.Run(context.Background(), nil)
			assert.NoError(t, err)
			assert.Equal(t, int64(len(tt.plugins)), report.Count)
			assert.Equal(t, tt.expectedErrors, report.Errors)
		})
	}
}

type mockPluginStore struct {
	pluginstore.Store
	plugins []pluginstore.Plugin
}

func (m *mockPluginStore) Plugins(ctx context.Context, t ...plugins.Type) []pluginstore.Plugin {
	return m.plugins
}

type mockPluginRepo struct {
	repo.Service
	pluginInfo        map[string]*repo.PluginInfo
	pluginArchiveInfo map[string]*repo.PluginArchiveInfo
}

func (m *mockPluginRepo) PluginInfo(ctx context.Context, id string) (*repo.PluginInfo, error) {
	return m.pluginInfo[id], nil
}

func (m *mockPluginRepo) GetPluginArchiveInfo(ctx context.Context, id, version string, opts repo.CompatOpts) (*repo.PluginArchiveInfo, error) {
	return m.pluginArchiveInfo[id], nil
}

type mockPluginPreinstall struct {
	plugininstaller.Preinstall
	pinned []string
}

func (m *mockPluginPreinstall) IsPinned(pluginID string) bool {
	for _, p := range m.pinned {
		if p == pluginID {
			return true
		}
	}
	return false
}

type mockManagedPlugins struct {
	managedplugins.Manager
	managed []string
}

func (m *mockManagedPlugins) ManagedPlugins(ctx context.Context) []string {
	return m.managed
}
