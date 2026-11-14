package setting

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReadPersonalAccessTokensSettings(t *testing.T) {
	t.Run("defaults are secure", func(t *testing.T) {
		s := readPersonalAccessTokensSettings(ini.Empty())
		require.False(t, s.Enabled)
		require.False(t, s.AllowNoExpiry)
		require.False(t, s.AllowAdminActions)
		require.Equal(t, 30, s.DefaultLifetimeDays)
		require.Equal(t, 90, s.MaxLifetimeDays)
		require.Equal(t, 10, s.MaxTokensPerUser)
	})

	t.Run("default lifetime is capped by max lifetime", func(t *testing.T) {
		f, err := ini.Load([]byte("[personal_access_tokens]\nenabled = true\ndefault_lifetime_days = 60\nmax_lifetime_days = 14\n"))
		require.NoError(t, err)
		s := readPersonalAccessTokensSettings(f)
		require.True(t, s.Enabled)
		require.Equal(t, 14, s.MaxLifetimeDays)
		require.Equal(t, 14, s.DefaultLifetimeDays)
	})

	t.Run("invalid values fall back to defaults", func(t *testing.T) {
		f, err := ini.Load([]byte("[personal_access_tokens]\nmax_lifetime_days = -5\nmax_tokens_per_user = -1\n"))
		require.NoError(t, err)
		s := readPersonalAccessTokensSettings(f)
		require.Equal(t, 90, s.MaxLifetimeDays)
		require.Equal(t, 10, s.MaxTokensPerUser)
	})
}
