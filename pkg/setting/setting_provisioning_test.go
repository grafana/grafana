package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadProvisioningResources(t *testing.T) {
	t.Run("defaults to dashboards and folders (enabled) when no sections are configured", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		assert.ElementsMatch(t, []ProvisioningResource{
			{Group: "dashboard.grafana.app", Kind: "Dashboard", EnableFolderSupport: true, Enabled: true},
			{Group: "folder.grafana.app", Kind: "Folder", EnableFolderSupport: true, Enabled: true},
		}, cfg.ProvisioningResources)
	})

	t.Run("parses [provisioning.resources.<kind>.<group>] sections", func(t *testing.T) {
		iniContent := `
[provisioning.resources.Dashboard.dashboard.grafana.app]
enableFolderSupport = true
enabled = true

[provisioning.resources.Playlist.playlist.grafana.app]
enableFolderSupport = false
enabled = false
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.ElementsMatch(t, []ProvisioningResource{
			{Group: "dashboard.grafana.app", Kind: "Dashboard", EnableFolderSupport: true, Enabled: true},
			{Group: "playlist.grafana.app", Kind: "Playlist", EnableFolderSupport: false, Enabled: false},
		}, cfg.ProvisioningResources)
	})

	t.Run("folder and enabled default when the keys are omitted", func(t *testing.T) {
		iniContent := `
[provisioning.resources.Playlist.playlist.grafana.app]
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		require.Len(t, cfg.ProvisioningResources, 1)
		// folder defaults to false; enabled defaults to true.
		assert.Equal(t, ProvisioningResource{Group: "playlist.grafana.app", Kind: "Playlist", EnableFolderSupport: false, Enabled: true}, cfg.ProvisioningResources[0])
	})
}
