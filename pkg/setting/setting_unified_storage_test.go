package setting

// import (
// 	"testing"

// 	"github.com/grafana/grafana/pkg/apiserver/rest"
// 	"github.com/stretchr/testify/assert"
// )

// func TestCfg_setUnifiedStorageConfig(t *testing.T) {
// 	t.Run("read unified_storage configs", func(t *testing.T) {
// 		cfg := NewCfg()
// 		err := cfg.Load(CommandLineArgs{HomePath: "../../", Config: "../../conf/defaults.ini"})
// 		assert.NoError(t, err)

// 		s, err := cfg.Raw.NewSection("unified_storage")
// 		assert.NoError(t, err)

// 		_, err = s.NewKey("playlist.grafana.app/playlists", "2")
// 		assert.NoError(t, err)

// 		cfg.setUnifiedStorageConfig()

// 		value, exists := cfg.UnifiedStorage["playlist.grafana.app/playlists"]

// 		assert.Equal(t, exists, true)
// 		assert.Equal(t, value, rest.DualWriterMode(2))
// 	})
// }
