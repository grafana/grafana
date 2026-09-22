package resource

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-app-sdk/app"
)

func TestRegisterAppManifest(t *testing.T) {
	// Registration is process-wide, so restore the previous state for other tests.
	t.Cleanup(func() {
		registeredManifestsMu.Lock()
		registeredManifests, manifestsRead = nil, false
		registeredManifestsMu.Unlock()
	})

	generated := generatedAppManifests()

	requirePanicContains(t, "nil or has no group", func() { RegisterAppManifest(nil) })
	requirePanicContains(t, "nil or has no group", func() {
		RegisterAppManifest(&app.ManifestData{AppName: "no-group"})
	})

	m := &app.ManifestData{AppName: "test-app", Group: "test.grafana.app"}
	RegisterAppManifest(m)

	requirePanicContains(t, "already registered", func() {
		RegisterAppManifest(&app.ManifestData{AppName: "other-app", Group: m.Group})
	})
	requirePanicContains(t, "already registered", func() {
		RegisterAppManifest(&app.ManifestData{AppName: "other-app", Group: generated[0].Group})
	})

	require.Contains(t, AppManifests(), m)
	require.Len(t, AppManifests(), len(generated)+1)

	requirePanicContains(t, "registered after AppManifests was read", func() {
		RegisterAppManifest(&app.ManifestData{AppName: "late-app", Group: "late.grafana.app"})
	})
}

func requirePanicContains(t *testing.T, want string, fn func()) {
	t.Helper()
	defer func() {
		r := recover()
		require.NotNil(t, r, "expected a panic containing %q", want)
		require.Contains(t, r, want)
	}()
	fn()
}
