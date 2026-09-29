package featuremgmt

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"
)

// WithEnabledFlags sets up an OpenFeature static provider with the given flags
// enabled for the duration of the test, then resets to the no-op provider.
func WithEnabledFlags(t *testing.T, flags ...string) {
	WithFlags(t, flags, []string{})
}

// WithDisabledFlags sets up an OpenFeature static provider with the given flags
// disabled for the duration of the test, then resets to the no-op provider.
func WithDisabledFlags(t *testing.T, flags ...string) {
	WithFlags(t, []string{}, flags)
}

// WithFlags sets up an OpenFeature static provider serving the given enabled and
// disabled flags for the duration of the test, then resets to the no-op provider.
// A flag listed in both enabled and disabled fails the test.
func WithFlags(t *testing.T, enabled, disabled []string) {
	t.Helper()

	inMemoryFlags := make(map[string]memprovider.InMemoryFlag, len(enabled)+len(disabled))
	for _, f := range enabled {
		inMemoryFlags[f] = setting.NewInMemoryFlag(f, true)
	}

	for _, f := range disabled {
		_, ok := inMemoryFlags[f]
		require.False(t, ok, fmt.Sprintf("flag %s cannot be enabled and disabled at time", f))

		inMemoryFlags[f] = setting.NewInMemoryFlag(f, false)
	}

	provider, err := CreateStaticProviderWithStandardFlags(inMemoryFlags)
	require.NoError(t, err)
	require.NoError(t, openfeature.SetProviderAndWait(provider))

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

// Disabled returns flags for use as the disabled list in WithFlags, improving
// call-site readability (e.g. WithFlags(t, Enabled("a"), Disabled("b"))).
func Disabled(flags ...string) []string {
	return flags
}

// Enabled returns flags for use as the enabled list in WithFlags, improving
// call-site readability (e.g. WithFlags(t, Enabled("a"), Disabled("b"))).
func Enabled(flags ...string) []string {
	return flags
}
