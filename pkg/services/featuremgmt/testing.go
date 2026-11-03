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

	values := make(map[string]any, len(enabled)+len(disabled))
	for _, f := range enabled {
		values[f] = true
	}

	for _, f := range disabled {
		_, ok := values[f]
		require.False(t, ok, fmt.Sprintf("flag %s cannot be enabled and disabled at time", f))

		values[f] = false
	}

	WithFlagValues(t, values)
}

// WithFlagValues sets up an OpenFeature static provider serving the given flag values, which may be
// of any type a flag supports (bool, int, float, string, object), for the duration of the test,
// then resets to the no-op provider.
func WithFlagValues(t *testing.T, values map[string]any) {
	t.Helper()

	inMemoryFlags := make(map[string]memprovider.InMemoryFlag, len(values))
	for name, value := range values {
		inMemoryFlags[name] = setting.NewInMemoryFlag(name, value)
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
