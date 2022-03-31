package manager

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins"
)

func (m *PluginManager) Plugin(ctx context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := m.plugin(ctx, pluginID)
	if !exists {
		return plugins.PluginDTO{}, false
	}

	return p.ToDTO(), true
}

func (m *PluginManager) Plugins(ctx context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	// if no types passed, assume all
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	var requestedTypes = make(map[plugins.Type]struct{})
	for _, pt := range pluginTypes {
		requestedTypes[pt] = struct{}{}
	}

	pluginsList := make([]plugins.PluginDTO, 0)
	for _, p := range m.availablePlugins(ctx) {
		if _, exists := requestedTypes[p.Type]; exists {
			pluginsList = append(pluginsList, p.ToDTO())
		}
	}
	return pluginsList
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *PluginManager) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

// availablePlugins returns all non-decommissioned plugins from the registry
func (m *PluginManager) availablePlugins(ctx context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}
	return res
}

// registeredPlugins returns all registered plugins from the registry
func (m *PluginManager) registeredPlugins(ctx context.Context) map[string]struct{} {
	pluginsByID := make(map[string]struct{})
	for _, p := range m.pluginRegistry.Plugins(ctx) {
		pluginsByID[p.ID] = struct{}{}
	}

	return pluginsByID
}
