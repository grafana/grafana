package registry

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
)

// SinglePluginVersion is a registry that only allows a single version of a plugin to be registered at a time.
type SinglePluginVersion struct {
	store map[string]*plugins.Plugin
	alias map[string]*plugins.Plugin
	mu    sync.RWMutex
}

func ProvideService() *SinglePluginVersion {
	return NewSinglePluginVersion()
}

func NewSinglePluginVersion() *SinglePluginVersion {
	return &SinglePluginVersion{
		store: make(map[string]*plugins.Plugin),
		alias: make(map[string]*plugins.Plugin),
	}
}

func (i *SinglePluginVersion) Plugin(_ context.Context, pluginID, _ string) (*plugins.Plugin, bool) {
	return i.plugin(pluginID)
}

func (i *SinglePluginVersion) Plugins(_ context.Context) []*plugins.Plugin {
	i.mu.RLock()
	defer i.mu.RUnlock()

	res := make([]*plugins.Plugin, 0, len(i.store))
	for _, p := range i.store {
		res = append(res, p)
	}

	return res
}

func (i *SinglePluginVersion) Add(_ context.Context, p *plugins.Plugin) error {
	if i.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	i.mu.Lock()
	i.store[p.ID] = p
	if p.Alias != "" {
		i.alias[p.Alias] = p
	}
	i.mu.Unlock()

	return nil
}

func (i *SinglePluginVersion) Remove(_ context.Context, pluginID, _ string) error {
	p, ok := i.plugin(pluginID)
	if !ok {
		return fmt.Errorf("plugin %s is not registered", pluginID)
	}

	i.mu.Lock()
	delete(i.store, pluginID)
	if p != nil && p.Alias != "" {
		delete(i.alias, p.Alias)
	}
	i.mu.Unlock()

	return nil
}

func (i *SinglePluginVersion) plugin(pluginID string) (*plugins.Plugin, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	p, exists := i.store[pluginID]

	if !exists {
		p, exists = i.alias[pluginID]
		if !exists {
			return nil, false
		}
	}

	return p, true
}

func (i *SinglePluginVersion) isRegistered(pluginID string) bool {
	p, exists := i.plugin(pluginID)

	// This may have matched based on an alias
	return exists && p.ID == pluginID
}
