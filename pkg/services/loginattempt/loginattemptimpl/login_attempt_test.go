package loginattemptimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/loginattempt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Validate(t *testing.T) {
	const maxInvalidLoginAttempts = 5

	testCases := []struct {
		name          string
		loginAttempts int64
		disabled      bool
		expected      bool
		expectedErr   error
	}{
		{
			name:          "When brute force protection enabled and user login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "When brute force protection enabled and user login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			expected:      false,
			expectedErr:   nil,
		},
		{
			name:          "When brute force protection enabled and user login attempt count is greater than max",
			loginAttempts: maxInvalidLoginAttempts + 1,
			expected:      false,
			expectedErr:   nil,
		},

		{
			name:          "When brute force protection disabled and user login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "When brute force protection disabled and user login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "When brute force protection disabled and user login attempt count is greater than max",
			loginAttempts: maxInvalidLoginAttempts + 1,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.BruteForceLoginProtectionMaxAttempts = maxInvalidLoginAttempts
			cfg.DisableBruteForceLoginProtection = tt.disabled
			service := &Service{
				store: fakeStore{
					ExpectedCount: tt.loginAttempts,
					ExpectedErr:   tt.expectedErr,
				},
				cfg: cfg,
			}

			ok, err := service.Validate(context.Background(), "test")
			assert.Equal(t, tt.expected, ok)
			assert.Equal(t, tt.expectedErr, err)
		})
	}
}

func TestLoginAttempts(t *testing.T) {
	ctx := context.Background()
	cfg := setting.NewCfg()
	cfg.DisableBruteForceLoginProtection = false
	cfg.BruteForceLoginProtectionMaxAttempts = 5
	db := db.InitTestDB(t)
	service := ProvideService(db, cfg, nil)

	// add multiple login attempts with different uppercases, they all should be counted as the same user
	_ = service.Add(ctx, "admin", "[::1]")
	_ = service.Add(ctx, "Admin", "[::1]")
	_ = service.Add(ctx, "aDmin", "[::1]")
	_ = service.Add(ctx, "adMin", "[::1]")
	_ = service.Add(ctx, "admIn", "[::1]")
	_ = service.Add(ctx, "admIN", "[::1]")

	// validate the number of attempts is correct for all the different uppercases
	count, err := service.store.GetUserLoginAttemptCount(ctx, GetUserLoginAttemptCountQuery{Username: "admin"})
	assert.Nil(t, err)
	assert.Equal(t, int64(6), count)

	ok, err := service.Validate(ctx, "admin")
	assert.False(t, ok)
	assert.Nil(t, err)
}

var _ store = new(fakeStore)

type fakeStore struct {
	ExpectedErr         error
	ExpectedCount       int64
	ExpectedDeletedRows int64
}

func (f fakeStore) GetUserLoginAttemptCount(ctx context.Context, query GetUserLoginAttemptCountQuery) (int64, error) {
	return f.ExpectedCount, f.ExpectedErr
}

func (f fakeStore) CreateLoginAttempt(ctx context.Context, command CreateLoginAttemptCommand) (loginattempt.LoginAttempt, error) {
	return loginattempt.LoginAttempt{}, f.ExpectedErr
}

func (f fakeStore) DeleteOldLoginAttempts(ctx context.Context, command DeleteOldLoginAttemptsCommand) (int64, error) {
	return f.ExpectedDeletedRows, f.ExpectedErr
}

func (f fakeStore) DeleteLoginAttempts(ctx context.Context, cmd DeleteLoginAttemptsCommand) error {
	return f.ExpectedErr
}
