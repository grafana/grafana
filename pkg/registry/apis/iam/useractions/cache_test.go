package useractions

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
)

// countingProvider reports how many times it was asked to resolve, and returns a
// different action each call so cache hits are distinguishable from misses.
type countingProvider struct{ calls int }

func (c *countingProvider) ActionsForUser(_ context.Context, _ identity.Requester, _ Options) (map[string]bool, error) {
	c.calls++
	return map[string]bool{"call": true, string(rune('a'+c.calls-1)) + ":read": true}, nil
}

func TestCachedProvider(t *testing.T) {
	caller := &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "u1"}

	t.Run("resolves once for repeated calls", func(t *testing.T) {
		counting := &countingProvider{}
		provider := NewCachedProvider(counting)

		first, err := provider.ActionsForUser(nsCtx("default"), caller, Options{})
		require.NoError(t, err)
		second, err := provider.ActionsForUser(nsCtx("default"), caller, Options{})
		require.NoError(t, err)

		require.Equal(t, 1, counting.calls, "second call must be served from cache")
		require.Equal(t, first, second)
	})

	t.Run("ReloadCache resolves again", func(t *testing.T) {
		counting := &countingProvider{}
		provider := NewCachedProvider(counting)

		_, err := provider.ActionsForUser(nsCtx("default"), caller, Options{})
		require.NoError(t, err)
		got, err := provider.ActionsForUser(nsCtx("default"), caller, Options{ReloadCache: true})
		require.NoError(t, err)

		require.Equal(t, 2, counting.calls)
		require.True(t, got["b:read"], "must return the freshly resolved set")
	})

	t.Run("caches per tenant", func(t *testing.T) {
		counting := &countingProvider{}
		provider := NewCachedProvider(counting)

		_, err := provider.ActionsForUser(nsCtx("stacks-11"), caller, Options{})
		require.NoError(t, err)
		_, err = provider.ActionsForUser(nsCtx("stacks-22"), caller, Options{})
		require.NoError(t, err)

		require.Equal(t, 2, counting.calls, "the same identity in another tenant must not hit the cache")
	})

	t.Run("returned map is not the cached map", func(t *testing.T) {
		provider := NewCachedProvider(&countingProvider{})

		first, err := provider.ActionsForUser(nsCtx("default"), caller, Options{})
		require.NoError(t, err)
		first["mutated"] = true

		second, err := provider.ActionsForUser(nsCtx("default"), caller, Options{})
		require.NoError(t, err)
		require.False(t, second["mutated"], "mutating a returned map must not corrupt the cache")
	})
}
