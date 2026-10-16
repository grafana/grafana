// Package pluginauthtest helps tests run with local plugin auth enabled.
package pluginauthtest

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// EnableAppManifests enables the appplugins.loadAppManifest feature toggle,
// which local plugin auth requires, for the rest of t. It replaces the global
// OpenFeature provider, so t must not run in parallel with tests that depend
// on other flags.
func EnableAppManifests(t testing.TB) {
	t.Helper()
	flag := featuremgmt.FlagApppluginsLoadAppManifest
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		flag: {Key: flag, DefaultVariant: "on", Variants: map[string]any{"on": true}},
	})))
	t.Cleanup(func() { require.NoError(t, openfeature.SetProviderAndWait(openfeature.NoopProvider{})) })
}
