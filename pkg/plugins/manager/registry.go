package manager

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

var _ plugins.IntRegistry = (*PluginRegistry)(nil)

type PluginRegistry struct {
	cfg   *plugins.Cfg
	store map[string]*plugins.Plugin
	mu    sync.RWMutex
	log   log.Logger
}

func ProvidePluginRegistry(grafanaCfg *setting.Cfg) *PluginRegistry {
	return NewPluginRegistry(grafanaCfg)
}

func NewPluginRegistry(grafanaCfg *setting.Cfg) *PluginRegistry {
	return &PluginRegistry{
		cfg:   plugins.FromGrafanaCfg(grafanaCfg),
		store: make(map[string]*plugins.Plugin),
		log:   log.New("int.plugin.registry"),
	}
}

func (r *PluginRegistry) Plugin(_ context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := r.plugin(pluginID)

	if !exists {
		return nil, false
	}

	return p, true
}

func (r *PluginRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	r.mu.RLock()
	defer r.mu.RUnlock()

	res := make([]*plugins.Plugin, 0)
	for _, p := range r.store {
		if !p.IsDecommissioned() {
			res = append(res, p)
		}
	}

	return res
}

func (r *PluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	if r.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	r.mu.Lock()
	r.store[p.ID] = p
	r.mu.Unlock()

	if !p.IsCorePlugin() {
		r.log.Info("Plugin registered", "pluginId", p.ID)
	}

	return nil
}

func (r *PluginRegistry) Remove(_ context.Context, pluginID string) error {
	if !r.isRegistered(pluginID) {
		return fmt.Errorf("plugin %s is already unregistered", pluginID)
	}

	r.mu.Lock()
	delete(r.store, pluginID)
	r.mu.Unlock()

	return nil
}

func (r *PluginRegistry) plugin(pluginID string) (*plugins.Plugin, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	p, exists := r.store[pluginID]

	if !exists || (p.IsDecommissioned()) {
		return nil, false
	}

	return p, true
}

func (r *PluginRegistry) isRegistered(pluginID string) bool {
	p, exists := r.plugin(pluginID)
	if !exists {
		return false
	}

	return !p.IsDecommissioned()
}
