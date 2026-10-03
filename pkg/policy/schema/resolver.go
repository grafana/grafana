// Package schema provides OpenAPI schema resolvers used to type policies.
//
// The engine accepts any resolver.SchemaResolver from k8s.io/apiserver, so a live server can be
// used through resolver.ClientDiscoveryResolver. This package adds resolvers for schemas that are
// available locally, and a cache.
package schema

import (
	"errors"
	"fmt"
	"sync"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/cel/openapi/resolver"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

// Resolver finds the OpenAPI schema of a kind. Returned schemas must have their references
// resolved, and must not include apiVersion, kind or metadata; the engine adds those.
type Resolver = resolver.SchemaResolver

// ErrSchemaNotFound is wrapped by resolvers when no schema exists for a kind.
var ErrSchemaNotFound = resolver.ErrSchemaNotFound

// StaticResolver resolves schemas from a fixed map.
type StaticResolver map[schema.GroupVersionKind]*spec.Schema

func (r StaticResolver) ResolveSchema(gvk schema.GroupVersionKind) (*spec.Schema, error) {
	s, ok := r[gvk]
	if !ok {
		return nil, fmt.Errorf("%w: %s", ErrSchemaNotFound, gvk)
	}
	return s, nil
}

// Combine returns a resolver that tries each resolver in order, moving on only when a
// resolver reports ErrSchemaNotFound.
func Combine(resolvers ...Resolver) Resolver {
	return combined(resolvers)
}

type combined []Resolver

func (c combined) ResolveSchema(gvk schema.GroupVersionKind) (*spec.Schema, error) {
	for _, r := range c {
		s, err := r.ResolveSchema(gvk)
		if err == nil {
			return s, nil
		}
		if !errors.Is(err, ErrSchemaNotFound) {
			return nil, err
		}
	}
	return nil, fmt.Errorf("%w: %s", ErrSchemaNotFound, gvk)
}

// NewCachingResolver caches successful resolutions of the given resolver. Failures are not
// cached, so a schema that becomes available later is picked up.
func NewCachingResolver(r Resolver) Resolver {
	return &cachingResolver{delegate: r, cache: map[schema.GroupVersionKind]*spec.Schema{}}
}

type cachingResolver struct {
	delegate Resolver
	mu       sync.RWMutex
	cache    map[schema.GroupVersionKind]*spec.Schema
}

func (c *cachingResolver) ResolveSchema(gvk schema.GroupVersionKind) (*spec.Schema, error) {
	c.mu.RLock()
	s, ok := c.cache[gvk]
	c.mu.RUnlock()
	if ok {
		return s, nil
	}
	s, err := c.delegate.ResolveSchema(gvk)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.cache[gvk] = s
	c.mu.Unlock()
	return s, nil
}
