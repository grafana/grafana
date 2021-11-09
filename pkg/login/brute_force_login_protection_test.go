package login

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateLoginAttempts(t *testing.T) {
	testCases := []struct {
		name          string
		loginAttempts int64
		cfg           *setting.Cfg
		expected      error
	}{
		{
			name:          "When brute force protection enabled and user login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			cfg:           cfgWithBruteForceLoginProtectionEnabled(t),
			expected:      nil,
		},
		{
			name:          "When brute force protection enabled and user login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			cfg:           cfgWithBruteForceLoginProtectionEnabled(t),
			expected:      ErrTooManyLoginAttempts,
		},
		{
			name:          "When brute force protection enabled and user login attempt count is greater than max",
			loginAttempts: maxInvalidLoginAttempts + 1,
			cfg:           cfgWithBruteForceLoginProtectionEnabled(t),
			expected:      ErrTooManyLoginAttempts,
		},

		{
			name:          "When brute force protection disabled and user login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			cfg:           cfgWithBruteForceLoginProtectionDisabled(t),
			expected:      nil,
		},
		{
			name:          "When brute force protection disabled and user login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			cfg:           cfgWithBruteForceLoginProtectionDisabled(t),
			expected:      nil,
		},
		{
			name:          "When brute force protection disabled and user login attempt count is greater than max",
			loginAttempts: maxInvalidLoginAttempts + 1,
			cfg:           cfgWithBruteForceLoginProtectionDisabled(t),
			expected:      nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			withLoginAttempts(t, tc.loginAttempts)

			query := &models.LoginUserQuery{Username: "user", Cfg: tc.cfg}
			err := validateLoginAttempts(context.Background(), query)
			require.Equal(t, tc.expected, err)
		})
	}
}

func TestSaveInvalidLoginAttempt(t *testing.T) {
	t.Run("When brute force protection enabled", func(t *testing.T) {
		t.Cleanup(func() { bus.ClearBusHandlers() })

		createLoginAttemptCmd := &models.CreateLoginAttemptCommand{}
		bus.AddHandler("test", func(cmd *models.CreateLoginAttemptCommand) error {
			createLoginAttemptCmd = cmd
			return nil
		})

		err := saveInvalidLoginAttempt(context.Background(), &models.LoginUserQuery{
			Username:  "user",
			Password:  "pwd",
			IpAddress: "192.168.1.1:56433",
			Cfg:       cfgWithBruteForceLoginProtectionEnabled(t),
		})
		require.NoError(t, err)

		require.NotNil(t, createLoginAttemptCmd)
		assert.Equal(t, "user", createLoginAttemptCmd.Username)
		assert.Equal(t, "192.168.1.1:56433", createLoginAttemptCmd.IpAddress)
	})

	t.Run("When brute force protection disabled", func(t *testing.T) {
		t.Cleanup(func() { bus.ClearBusHandlers() })

		var createLoginAttemptCmd *models.CreateLoginAttemptCommand
		bus.AddHandler("test", func(cmd *models.CreateLoginAttemptCommand) error {
			createLoginAttemptCmd = cmd
			return nil
		})

		err := saveInvalidLoginAttempt(context.Background(), &models.LoginUserQuery{
			Username:  "user",
			Password:  "pwd",
			IpAddress: "192.168.1.1:56433",
			Cfg:       cfgWithBruteForceLoginProtectionDisabled(t),
		})
		require.NoError(t, err)

		require.Nil(t, createLoginAttemptCmd)
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

func withLoginAttempts(t *testing.T, loginAttempts int64) {
	t.Helper()
	bus.AddHandler("test", func(query *models.GetUserLoginAttemptCountQuery) error {
		query.Result = loginAttempts
		return nil
	})
}
