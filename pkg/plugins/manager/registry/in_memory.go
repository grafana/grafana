package registry

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/setting"
)

type InMemory struct {
	cfg   *plugins.Cfg
	store map[string]*plugins.Plugin
	mu    sync.RWMutex
	log   log.Logger
}

func ProvideService(grafanaCfg *setting.Cfg) *InMemory {
	return NewPluginRegistry(plugins.FromGrafanaCfg(grafanaCfg))
}

func NewPluginRegistry(cfg *plugins.Cfg) *InMemory {
	return &InMemory{
		cfg:   cfg,
		store: make(map[string]*plugins.Plugin),
		log:   log.New("int.plugin.registry"),
	}
}

func (i *InMemory) Plugin(_ context.Context, pluginID string) (*plugins.Plugin, bool) {
	return i.plugin(pluginID)
}

func (i *InMemory) Plugins(_ context.Context) []*plugins.Plugin {
	i.mu.RLock()
	defer i.mu.RUnlock()

	res := make([]*plugins.Plugin, 0)
	for _, p := range i.store {
		res = append(res, p)
	}

	return res
}

func (i *InMemory) Add(_ context.Context, p *plugins.Plugin) error {
	if i.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	i.mu.Lock()
	i.store[p.ID] = p
	i.mu.Unlock()

	return nil
}

func (i *InMemory) Remove(_ context.Context, pluginID string) error {
	if !i.isRegistered(pluginID) {
		return fmt.Errorf("plugin %s is already unregistered", pluginID)
	}

	i.mu.Lock()
	delete(i.store, pluginID)
	i.mu.Unlock()

	return nil
}

func (i *InMemory) plugin(pluginID string) (*plugins.Plugin, bool) {
	i.mu.RLock()
	defer i.mu.RUnlock()
	p, exists := i.store[pluginID]

	if !exists {
		return nil, false
	}

	return p, true
}

func (i *InMemory) isRegistered(pluginID string) bool {
	_, exists := i.plugin(pluginID)
	return exists
}
