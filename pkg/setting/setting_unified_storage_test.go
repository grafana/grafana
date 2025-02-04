package setting

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCfg_setUnifiedStorageConfig(t *testing.T) {
	t.Run("read unified_storage configs", func(t *testing.T) {
		cfg := NewCfg()
		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
		assert.NoError(t, err)

		s, err := cfg.Raw.NewSection("unified_storage.playlists.playlist.grafana.app")
		assert.NoError(t, err)

		_, err = s.NewKey("dualWriterMode", "2")
		assert.NoError(t, err)

		_, err = s.NewKey("dualWriterPeriodicDataSyncJobEnabled", "true")
		assert.NoError(t, err)

		_, err = s.NewKey("dataSyncerRecordsLimit", "1001")
		assert.NoError(t, err)

		_, err = s.NewKey("dataSyncerInterval", "10m")
		assert.NoError(t, err)

		cfg.setUnifiedStorageConfig()

		value, exists := cfg.UnifiedStorage["playlists.playlist.grafana.app"]

		assert.Equal(t, exists, true)
		assert.Equal(t, value, UnifiedStorageConfig{
			DualWriterMode:                       2,
			DualWriterPeriodicDataSyncJobEnabled: true,
			DataSyncerRecordsLimit:               1001,
			DataSyncerInterval:                   time.Minute * 10,
		})
	})
}
