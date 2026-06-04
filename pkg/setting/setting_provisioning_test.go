package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadProvisioningResources(t *testing.T) {
	t.Run("defaults to dashboards and folders when no sections are configured", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		assert.ElementsMatch(t, []ProvisioningResource{
			{Group: "dashboard.grafana.app", Kind: "Dashboard", SupportsFolderAnnotation: true},
			{Group: "folder.grafana.app", Kind: "Folder", SupportsFolderAnnotation: true},
		}, cfg.ProvisioningResources)
	})

	t.Run("parses [provisioning.resources.<kind>.<group>] sections", func(t *testing.T) {
		iniContent := `
[provisioning.resources.Dashboard.dashboard.grafana.app]
folder = true

[provisioning.resources.Playlist.playlist.grafana.app]
folder = false
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.ElementsMatch(t, []ProvisioningResource{
			{Group: "dashboard.grafana.app", Kind: "Dashboard", SupportsFolderAnnotation: true},
			{Group: "playlist.grafana.app", Kind: "Playlist", SupportsFolderAnnotation: false},
		}, cfg.ProvisioningResources)
	})

	t.Run("folder defaults to false when the key is omitted", func(t *testing.T) {
		iniContent := `
[provisioning.resources.Playlist.playlist.grafana.app]
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		require.Len(t, cfg.ProvisioningResources, 1)
		assert.Equal(t, ProvisioningResource{Group: "playlist.grafana.app", Kind: "Playlist", SupportsFolderAnnotation: false}, cfg.ProvisioningResources[0])
	})
}
