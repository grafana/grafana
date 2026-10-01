package setting

import (
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Playlists opt into KV-sourced search fields, which are only meaningful when
// unified storage is the system of record for them (not dual-write).
func TestPlaylistsAreUnifiedStorageSystemOfRecordByDefault(t *testing.T) {
	t.Run("playlists are migrated by default", func(t *testing.T) {
		assert.True(t, MigratedUnifiedResources[PlaylistResource])
	})

	t.Run("default config serves playlists in mode 5", func(t *testing.T) {
		cfg := NewCfg()
		require.NoError(t, cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"}))
		pc := cfg.UnifiedStorageConfig(PlaylistResource)
		assert.Equal(t, rest.Mode5, pc.DualWriterMode)
		assert.True(t, pc.EnableMigration)
	})
}
