package collections

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/collections/pkg/apis/manifestdata"
)

// The generic search and list-keys routes are mounted for every kind unless the manifest opts out, so a
// slideshow would be indexed and searchable without this.
func TestSlideshowsDoNotServeGenericSearch(t *testing.T) {
	found := false
	for _, version := range manifestdata.LocalManifest().ManifestData.Versions {
		for _, kind := range version.Kinds {
			if kind.Kind == "Slideshow" {
				found = true
				require.False(t, kind.HasSearchEndpoint())
				require.False(t, kind.HasListKeysEndpoint())
			}
		}
	}
	require.True(t, found, "slideshow kind is missing from the manifest")
}
