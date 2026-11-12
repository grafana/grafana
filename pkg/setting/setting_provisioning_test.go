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

func TestReadProvisioningResourceListerPageSize(t *testing.T) {
	t.Run("absent reads as zero, which the reader maps to its default", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		assert.Zero(t, cfg.ProvisioningResourceListerPageSize)
	})

	t.Run("reads the key", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte("[provisioning]\nresource_lister_page_size = 50\n"))
		require.NoError(t, err)

		assert.Equal(t, int64(50), cfg.ProvisioningResourceListerPageSize)
	})
}
