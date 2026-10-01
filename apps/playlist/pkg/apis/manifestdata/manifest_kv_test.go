package manifestdata

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestPlaylistManifestData_Validate guards that the generated manifest data is internally
// consistent across all versions and kinds.
func TestPlaylistManifestData_Validate(t *testing.T) {
	t.Parallel()
	m := LocalManifest()
	require.NotNil(t, m.ManifestData)
	assert.NoError(t, m.ManifestData.Validate())
}

// TestPlaylistManifestData_PlaylistKind_HasKV guards that all served Playlist versions declare the
// kv subresource. If a codegen regeneration silently drops the declaration, this test will catch it.
func TestPlaylistManifestData_PlaylistKind_HasKV(t *testing.T) {
	t.Parallel()
	m := LocalManifest()
	require.NotNil(t, m.ManifestData)

	servedVersionsChecked := 0
	for _, version := range m.ManifestData.Versions {
		if !version.Served {
			continue
		}
		for _, kind := range version.Kinds {
			if kind.Kind != "Playlist" {
				continue
			}
			servedVersionsChecked++
			t.Run(version.Name, func(t *testing.T) {
				t.Parallel()
				assert.True(t, kind.HasKV(),
					"Playlist kind in served version %s must declare kv", version.Name)
			})
		}
	}
	// Sanity-check: there must be at least one served Playlist version or the test is vacuously passing.
	require.Greater(t, servedVersionsChecked, 0, "expected at least one served Playlist version")
}
