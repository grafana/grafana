package featuremgmt

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
)

// WithEnabledFlags sets up an OpenFeature static provider with the given flags
// enabled for the duration of the test, then resets to the no-op provider.
func WithEnabledFlags(t *testing.T, flags ...string) {
	t.Helper()

	inMemoryFlags := make(map[string]memprovider.InMemoryFlag, len(flags))
	for _, f := range flags {
		inMemoryFlags[f] = setting.NewInMemoryFlag(f, true)
	}
	provider, err := CreateStaticProviderWithStandardFlags(inMemoryFlags)
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}
