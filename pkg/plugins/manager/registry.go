package manager

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/plugins"
)

func (m *PluginManager) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := m.plugin(pluginID)

	if !exists {
		return plugins.PluginDTO{}, false
	}

	return p.ToDTO(), true
}

func (m *PluginManager) Plugins(_ context.Context, pluginTypes ...plugins.Type) []plugins.PluginDTO {
	// if no types passed, assume all
	if len(pluginTypes) == 0 {
		pluginTypes = plugins.PluginTypes
	}

	var requestedTypes = make(map[plugins.Type]struct{})
	for _, pt := range pluginTypes {
		requestedTypes[pt] = struct{}{}
	}

	pluginsList := make([]plugins.PluginDTO, 0)
	for _, p := range m.plugins() {
		if _, exists := requestedTypes[p.Type]; exists {
			pluginsList = append(pluginsList, p.ToDTO())
		}
	}
	return pluginsList
}

func (m *PluginManager) register(p *plugins.Plugin) error {
	if m.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	m.pluginsMu.Lock()
	m.store[p.ID] = p
	m.pluginsMu.Unlock()

	if !p.IsCorePlugin() {
		m.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return nil
}

func (m *PluginManager) plugin(pluginID string) (*plugins.Plugin, bool) {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()
	p, exists := m.store[pluginID]

	if !exists || (p.IsDecommissioned()) {
		return nil, false
	}

	return p, true
}

func (m *PluginManager) plugins() []*plugins.Plugin {
	m.pluginsMu.RLock()
	defer m.pluginsMu.RUnlock()

	res := make([]*plugins.Plugin, 0)
	for _, p := range m.store {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}

	return res
}

func (m *PluginManager) registeredPlugins() map[string]struct{} {
	pluginsByID := make(map[string]struct{})
	for _, p := range m.plugins() {
		pluginsByID[p.ID] = struct{}{}
	}

	return pluginsByID
}
