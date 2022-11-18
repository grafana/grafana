package login

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSaveInvalidLoginAttempt(t *testing.T) {
	t.Run("When brute force protection enabled", func(t *testing.T) {
		store := mockstore.NewSQLStoreMock()
		err := saveInvalidLoginAttempt(context.Background(), &models.LoginUserQuery{
			Username:  "user",
			Password:  "pwd",
			IpAddress: "192.168.1.1:56433",
			Cfg:       cfgWithBruteForceLoginProtectionEnabled(t),
		}, store)
		require.NoError(t, err)

		require.NotNil(t, store.LastLoginAttemptCommand)
		assert.Equal(t, "user", store.LastLoginAttemptCommand.Username)
		assert.Equal(t, "192.168.1.1:56433", store.LastLoginAttemptCommand.IpAddress)
	})

	t.Run("When brute force protection disabled", func(t *testing.T) {
		store := mockstore.NewSQLStoreMock()
		err := saveInvalidLoginAttempt(context.Background(), &models.LoginUserQuery{
			Username:  "user",
			Password:  "pwd",
			IpAddress: "192.168.1.1:56433",
			Cfg:       cfgWithBruteForceLoginProtectionDisabled(t),
		}, store)
		require.NoError(t, err)

		require.Nil(t, store.LastLoginAttemptCommand)
	})
}

func cfgWithBruteForceLoginProtectionDisabled(t *testing.T) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.DisableBruteForceLoginProtection = true
	return cfg
}

func cfgWithBruteForceLoginProtectionEnabled(t *testing.T) *setting.Cfg {
	t.Helper()
	cfg := setting.NewCfg()
	require.False(t, cfg.DisableBruteForceLoginProtection)
	return cfg
}
