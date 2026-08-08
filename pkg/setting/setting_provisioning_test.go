package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadProvisioningResources(t *testing.T) {
	t.Run("defaults when [provisioning] resources is unset", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		assert.Equal(t, []string{
			"folder.grafana.app/Folder:folder",
			"dashboard.grafana.app/Dashboard:folder",
			"dashboard.grafana.app/LibraryPanel:folder:disabled",
			"playlist.grafana.app/Playlist:disabled",
		}, cfg.ProvisioningResources)
	})

	t.Run("parses the comma-separated token list", func(t *testing.T) {
		iniContent := `
[provisioning]
resources = dashboard.grafana.app/Dashboard:folder, playlist.grafana.app/Playlist
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, []string{
			"dashboard.grafana.app/Dashboard:folder",
			"playlist.grafana.app/Playlist",
		}, cfg.ProvisioningResources)
	})
}

func TestReadProvisioningMaxSyncWorkers(t *testing.T) {
	t.Run("uses defaults", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		assert.Equal(t, ProvisioningMaxSyncWorkersDefault, cfg.ProvisioningMaxSyncWorkers)
	})

	t.Run("reads configured values", func(t *testing.T) {
		iniContent := `
[provisioning]
max_sync_workers = 3
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, 3, cfg.ProvisioningMaxSyncWorkers)
	})
}
