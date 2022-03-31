package registry

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type PluginRegistry struct {
	cfg   *plugins.Cfg
	store map[string]*plugins.Plugin
	mu    sync.RWMutex
	log   log.Logger
}

func ProvideService(grafanaCfg *setting.Cfg) *PluginRegistry {
	return NewPluginRegistry(plugins.FromGrafanaCfg(grafanaCfg))
}

func NewPluginRegistry(cfg *plugins.Cfg) *PluginRegistry {
	return &PluginRegistry{
		cfg:   cfg,
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
		res = append(res, p)
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

	if !exists {
		return nil, false
	}

	return p, true
}

func (r *PluginRegistry) isRegistered(pluginID string) bool {
	_, exists := r.plugin(pluginID)
	return exists
}
