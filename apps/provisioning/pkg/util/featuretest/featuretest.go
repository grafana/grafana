// Package featuretest serves OpenFeature flags to tests, which read them
// through the global default client.
package featuretest

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
)

// Enable turns flags on for the duration of the test.
func Enable(t *testing.T, flags ...string) {
	t.Helper()
	values := make(map[string]bool, len(flags))
	for _, flag := range flags {
		values[flag] = true
	}
	Set(t, values)
}

// Set serves the given boolean flag values for the duration of the test, then
// restores the no-op provider.
func Set(t *testing.T, values map[string]bool) {
	t.Helper()
	flags := make(map[string]memprovider.InMemoryFlag, len(values))
	for name, value := range values {
		flags[name] = memprovider.InMemoryFlag{
			Key:            name,
			DefaultVariant: "configured",
			Variants:       map[string]any{"configured": value},
		}
	}
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(flags)))
	t.Cleanup(func() {
		require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{}))
	})
}
