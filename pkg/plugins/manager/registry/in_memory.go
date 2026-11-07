package registry

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/plugins"
)

// InMemory is a registry that only allows a single version of a plugin to be registered at a time.
type InMemory struct {
	store map[string]*plugins.Plugin
	alias map[string]*plugins.Plugin
	mu    sync.RWMutex
}

func ProvideService() *InMemory {
	return NewInMemory()
}

func NewInMemory() *InMemory {
	return &InMemory{
		store: make(map[string]*plugins.Plugin),
		alias: make(map[string]*plugins.Plugin),
	}
}

func (i *InMemory) Plugin(_ context.Context, pluginID, _ string) (*plugins.Plugin, bool) {
	return i.plugin(pluginID)
}

func (i *InMemory) Plugins(_ context.Context) []*plugins.Plugin {
	i.mu.RLock()
	defer i.mu.RUnlock()

	res := make([]*plugins.Plugin, 0, len(i.store))
	for _, p := range i.store {
		res = append(res, p)
	}

	return res
}

func (i *InMemory) Add(_ context.Context, p *plugins.Plugin) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if i.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	i.store[p.ID] = p
	for _, a := range p.AliasIDs {
		i.alias[a] = p
	}

	return nil
}

func (i *InMemory) Remove(_ context.Context, pluginID, _ string) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	p, ok := i.lookup(pluginID)
	if !ok {
		return fmt.Errorf("plugin %s is not registered", pluginID)
	}

	// pluginID may be an alias, so remove the plugin it resolves to.
	delete(i.store, p.ID)
	for _, a := range p.AliasIDs {
		delete(i.alias, a)
	}

	return nil
}

func (i *InMemory) plugin(pluginID string) (*plugins.Plugin, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	return i.lookup(pluginID)
}

// lookup finds a plugin by its ID, then by an alias. The caller must hold mu.
func (i *InMemory) lookup(pluginID string) (*plugins.Plugin, bool) {
	if p, exists := i.store[pluginID]; exists {
		return p, true
	}
	p, exists := i.alias[pluginID]
	return p, exists
}

// isRegistered reports whether a plugin is registered under pluginID. The
// caller must hold mu.
func (i *InMemory) isRegistered(pluginID string) bool {
	p, exists := i.lookup(pluginID)

	// This may have matched based on an alias
	return exists && p.ID == pluginID
}
