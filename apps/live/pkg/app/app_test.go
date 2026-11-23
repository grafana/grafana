package app

import (
	"testing"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/live/pkg/apis/manifestdata"
)

func TestManifest(t *testing.T) {
	manifest := manifestdata.LocalManifest().ManifestData
	for _, v := range manifest.Versions {
		for _, k := range v.Kinds {
			require.NotNil(t, k.Schema)
		}
	}
}

// New validates the app's route handlers against the manifest, so this fails
// when a manifest route has no handler or the other way around.
func TestNewMatchesManifest(t *testing.T) {
	_, err := New(app.Config{ManifestData: *manifestdata.LocalManifest().ManifestData})
	require.NoError(t, err)
}
