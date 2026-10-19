package accesscontrol_test

import (
	"context"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func TestScopeResolverRegistry_Empty(t *testing.T) {
	tests := []struct {
		name     string
		registry *accesscontrol.ScopeResolverRegistry
	}{
		{
			name:     "nil registry",
			registry: nil,
		},
		{
			name:     "zero value",
			registry: &accesscontrol.ScopeResolverRegistry{},
		},
		{
			name:     "new registry",
			registry: accesscontrol.NewScopeResolverRegistry(),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver, ok := tt.registry.Get("folders:uid:")

			require.False(t, ok)
			require.Nil(t, resolver)
			require.False(t, tt.registry.HasResolvers())
		})
	}
}

func TestScopeResolverRegistry_Register(t *testing.T) {
	var registry accesscontrol.ScopeResolverRegistry
	folderResolver := &registryTestResolver{}
	dashboardResolver := &registryTestResolver{}
	replacement := &registryTestResolver{}

	registry.Register("folders:uid:", folderResolver)
	registry.Register("dashboards:uid:", dashboardResolver)

	resolver, ok := registry.Get("folders:uid:")
	require.True(t, ok)
	require.Same(t, folderResolver, resolver)
	require.True(t, registry.HasResolvers())

	registry.Register("folders:uid:", replacement)

	resolver, ok = registry.Get("folders:uid:")
	require.True(t, ok)
	require.Same(t, replacement, resolver)

	resolver, ok = registry.Get("dashboards:uid:")
	require.True(t, ok)
	require.Same(t, dashboardResolver, resolver)

	resolver, ok = registry.Get("datasources:uid:")
	require.False(t, ok)
	require.Nil(t, resolver)
}

func TestScopeResolverRegistry_ConcurrentRegistrationAndLookup(t *testing.T) {
	registry := accesscontrol.NewScopeResolverRegistry()
	start := make(chan struct{})
	var workers sync.WaitGroup

	for i := range 16 {
		workers.Add(1)
		go func() {
			defer workers.Done()
			<-start

			prefix := fmt.Sprintf("resources%d:uid:", i)
			resolver := &registryTestResolver{}
			for range 32 {
				registry.Register(prefix, resolver)
				registered, ok := registry.Get(prefix)
				if !ok || registered != resolver {
					t.Errorf("registered resolver is missing for %s", prefix)
					return
				}
				if !registry.HasResolvers() {
					t.Error("registry reports no resolvers after registration")
					return
				}
			}
		}()
	}

	close(start)
	workers.Wait()
}

type registryTestResolver struct {
	scopes []string
}

func (r *registryTestResolver) Resolve(_ context.Context, _ int64, _ string) ([]string, error) {
	return r.scopes, nil
}
