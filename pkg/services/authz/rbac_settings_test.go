package authz

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestReadAuthzClientSettings_LocalFolderCacheTTL(t *testing.T) {
	t.Run("defaults to 30s when not configured", func(t *testing.T) {
		cfg, err := setting.NewCfgFromBytes([]byte(``))
		require.NoError(t, err)

		s, err := readAuthzClientSettings(cfg)
		require.NoError(t, err)
		require.Equal(t, 30*time.Second, s.localFolderCacheTTL)
	})

	t.Run("reads override from the authorization section", func(t *testing.T) {
		cfg, err := setting.NewCfgFromBytes([]byte(`
[authorization]
local_folder_cache_ttl = 5s
`))
		require.NoError(t, err)

		s, err := readAuthzClientSettings(cfg)
		require.NoError(t, err)
		require.Equal(t, 5*time.Second, s.localFolderCacheTTL)
	})

	t.Run("can be disabled with 0", func(t *testing.T) {
		cfg, err := setting.NewCfgFromBytes([]byte(`
[authorization]
local_folder_cache_ttl = 0
`))
		require.NoError(t, err)

		s, err := readAuthzClientSettings(cfg)
		require.NoError(t, err)
		require.Equal(t, time.Duration(0), s.localFolderCacheTTL)
	})
}
