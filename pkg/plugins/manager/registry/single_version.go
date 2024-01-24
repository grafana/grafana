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
	return NewSinglePluginVersionRegistry()
}

func NewSinglePluginVersionRegistry() *SinglePluginVersion {
	return &SinglePluginVersion{
		store: make(map[string]*plugins.Plugin),
		alias: make(map[string]*plugins.Plugin),
	}
}

func (s *SinglePluginVersion) Plugin(_ context.Context, pluginID, _ string) (*plugins.Plugin, bool) {
	return s.plugin(pluginID)
}

func (s *SinglePluginVersion) Plugins(_ context.Context) []*plugins.Plugin {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]*plugins.Plugin, 0, len(s.store))
	for _, p := range s.store {
		res = append(res, p)
	}

	return res
}

func (s *SinglePluginVersion) Add(_ context.Context, p *plugins.Plugin) error {
	if s.isRegistered(p.ID) {
		return fmt.Errorf("plugin %s is already registered", p.ID)
	}

	s.mu.Lock()
	s.store[p.ID] = p
	for _, a := range p.AliasIDs {
		s.alias[a] = p
	}
	s.mu.Unlock()

	return nil
}

func (s *SinglePluginVersion) Remove(_ context.Context, pluginID, _ string) error {
	p, ok := s.plugin(pluginID)
	if !ok {
		return fmt.Errorf("plugin %s is not registered", pluginID)
	}

	s.mu.Lock()
	delete(s.store, pluginID)
	if p != nil {
		for _, a := range p.AliasIDs {
			delete(s.alias, a)
		}
	}
	s.mu.Unlock()

	return nil
}

func (s *SinglePluginVersion) plugin(pluginID string) (*plugins.Plugin, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, exists := s.store[pluginID]

	if !exists {
		p, exists = s.alias[pluginID]
		if !exists {
			return nil, false
		}
	}

	return p, true
}

func (s *SinglePluginVersion) isRegistered(pluginID string) bool {
	p, exists := s.plugin(pluginID)

	// This may have matched based on an alias
	return exists && p.ID == pluginID
}
