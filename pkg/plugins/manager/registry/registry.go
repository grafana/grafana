package registry

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
)

// MultiPluginVersion is a registry that only allows a single version of a plugin to be registered at a time.
type MultiPluginVersion struct {
	store map[string]*plugins.Plugin
	mu    sync.RWMutex
}

func NewMultiPluginVersion(ps ...*plugins.Plugin) *MultiPluginVersion {
	store := make(map[string]*plugins.Plugin)
	for _, p := range ps {
		store[storeKey(p.ID, p.Info.Version)] = p
	}

	return &MultiPluginVersion{
		store: store,
	}
}

func (d *MultiPluginVersion) Plugin(_ context.Context, pluginID, version string) (*plugins.Plugin, bool) {
	return d.plugin(pluginID, version)
}

func (d *MultiPluginVersion) Plugins(_ context.Context) []*plugins.Plugin {
	d.mu.RLock()
	defer d.mu.RUnlock()

	res := make([]*plugins.Plugin, 0, len(d.store))
	for _, p := range d.store {
		res = append(res, p)
	}

	return res
}

func (d *MultiPluginVersion) Add(_ context.Context, p *plugins.Plugin) error {
	_, exists := d.plugin(p.ID, p.Info.Version)
	if exists {
		return fmt.Errorf("plugin %s v%s is already registered", p.ID, p.Info.Version)
	}

	d.mu.Lock()
	d.store[storeKey(p.ID, p.Info.Version)] = p
	d.mu.Unlock()

	return nil
}

func (d *MultiPluginVersion) Remove(_ context.Context, pluginID, version string) error {
	_, exists := d.plugin(pluginID, version)
	if !exists {
		return fmt.Errorf("plugin %s v%s is not registered", pluginID, version)
	}

	d.mu.Lock()
	delete(d.store, storeKey(pluginID, version))
	d.mu.Unlock()

	return nil
}

func (d *MultiPluginVersion) plugin(pluginID, version string) (*plugins.Plugin, bool) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	key := storeKey(pluginID, version)
	p, exists := d.store[key]

	return p, exists
}

func storeKey(pluginID, version string) string {
	return fmt.Sprintf("%s@%s", pluginID, version)
}
