package accesscontrol

import "sync"

// ScopeResolverRegistry shares registrations without sharing evaluation caches.
// Consumers holding the registry also see resolvers registered later.
type ScopeResolverRegistry struct {
	mu        sync.RWMutex
	resolvers map[string]ScopeAttributeResolver
}

func NewScopeResolverRegistry() *ScopeResolverRegistry {
	return &ScopeResolverRegistry{
		resolvers: make(map[string]ScopeAttributeResolver),
	}
}

func (r *ScopeResolverRegistry) Register(prefix string, resolver ScopeAttributeResolver) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.resolvers == nil {
		r.resolvers = make(map[string]ScopeAttributeResolver)
	}
	r.resolvers[prefix] = resolver
}

func (r *ScopeResolverRegistry) Get(prefix string) (ScopeAttributeResolver, bool) {
	if r == nil {
		return nil, false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()

	resolver, ok := r.resolvers[prefix]
	return resolver, ok
}

func (r *ScopeResolverRegistry) HasResolvers() bool {
	if r == nil {
		return false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()

	return len(r.resolvers) > 0
}
