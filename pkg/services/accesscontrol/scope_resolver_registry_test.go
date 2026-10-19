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
	folderResolver := &registryTestResolver{}
	dashboardResolver := &registryTestResolver{}
	replacement := &registryTestResolver{}

	tests := []struct {
		name          string
		registrations []registryTestRegistration
		prefix        string
		wantResolver  *registryTestResolver
		wantFound     bool
	}{
		{
			name: "register resolver on zero value registry",
			registrations: []registryTestRegistration{
				{
					prefix:   "folders:uid:",
					resolver: folderResolver,
				},
			},
			prefix:       "folders:uid:",
			wantResolver: folderResolver,
			wantFound:    true,
		},
		{
			name: "replace resolver for the same prefix",
			registrations: []registryTestRegistration{
				{
					prefix:   "folders:uid:",
					resolver: folderResolver,
				},
				{
					prefix:   "folders:uid:",
					resolver: replacement,
				},
			},
			prefix:       "folders:uid:",
			wantResolver: replacement,
			wantFound:    true,
		},
		{
			name: "replacing a resolver preserves other prefixes",
			registrations: []registryTestRegistration{
				{
					prefix:   "folders:uid:",
					resolver: folderResolver,
				},
				{
					prefix:   "dashboards:uid:",
					resolver: dashboardResolver,
				},
				{
					prefix:   "folders:uid:",
					resolver: replacement,
				},
			},
			prefix:       "dashboards:uid:",
			wantResolver: dashboardResolver,
			wantFound:    true,
		},
		{
			name: "missing prefix",
			registrations: []registryTestRegistration{
				{
					prefix:   "folders:uid:",
					resolver: folderResolver,
				},
			},
			prefix:       "datasources:uid:",
			wantResolver: nil,
			wantFound:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var registry accesscontrol.ScopeResolverRegistry
			for _, registration := range tt.registrations {
				registry.Register(registration.prefix, registration.resolver)
			}

			resolver, ok := registry.Get(tt.prefix)

			require.Equal(t, tt.wantFound, ok)
			require.True(t, registry.HasResolvers())
			if tt.wantResolver == nil {
				require.Nil(t, resolver)
				return
			}
			require.Same(t, tt.wantResolver, resolver)
		})
	}
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

type registryTestRegistration struct {
	prefix   string
	resolver *registryTestResolver
}

type registryTestResolver struct {
	scopes []string
}

func (r *registryTestResolver) Resolve(_ context.Context, _ int64, _ string) ([]string, error) {
	return r.scopes, nil
}
