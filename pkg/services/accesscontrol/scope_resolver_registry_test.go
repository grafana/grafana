package accesscontrol_test

import (
	"context"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/assert"
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
	synctest.Test(t, func(t *testing.T) {
		registry := accesscontrol.NewScopeResolverRegistry()
		registrations := []registryTestRegistration{
			{
				prefix:   "folders:uid:",
				resolver: &registryTestResolver{},
			},
			{
				prefix:   "dashboards:uid:",
				resolver: &registryTestResolver{},
			},
			{
				prefix:   "datasources:uid:",
				resolver: &registryTestResolver{},
			},
		}
		start := make(chan struct{})

		for _, registration := range registrations {
			go func() {
				<-start

				registry.Register(registration.prefix, registration.resolver)
				resolver, ok := registry.Get(registration.prefix)

				assert.True(t, ok, registration.prefix)
				assert.Same(t, registration.resolver, resolver, registration.prefix)
				assert.True(t, registry.HasResolvers())
			}()
		}

		// Wait until every worker is blocked on start before releasing them.
		synctest.Wait()
		close(start)
		synctest.Wait()

		for _, registration := range registrations {
			resolver, ok := registry.Get(registration.prefix)

			require.True(t, ok, registration.prefix)
			require.Same(t, registration.resolver, resolver, registration.prefix)
		}
	})
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
