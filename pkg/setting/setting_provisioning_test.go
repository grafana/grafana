package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestReadProvisioningSettings_Resources(t *testing.T) {
	t.Run("defaults to dashboards and folders when unset", func(t *testing.T) {
		cfg, err := NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		assert.Equal(t, []string{"dashboards", "folders"}, cfg.ProvisioningResources)
		assert.Equal(t, []string{"dashboards", "folders"}, cfg.ProvisioningFolderResources)
	})

	t.Run("parses the configured resource lists", func(t *testing.T) {
		iniContent := `
[provisioning]
resources = dashboards | folders | playlists
folder_resources = dashboards | folders
`
		cfg, err := NewCfgFromBytes([]byte(iniContent))
		require.NoError(t, err)

		assert.Equal(t, []string{"dashboards", "folders", "playlists"}, cfg.ProvisioningResources)
		assert.Equal(t, []string{"dashboards", "folders"}, cfg.ProvisioningFolderResources)
	})
}
