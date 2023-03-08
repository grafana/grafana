package loginattemptimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Validate(t *testing.T) {
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

var _ store = new(fakeStore)

type fakeStore struct {
	ExpectedErr         error
	ExpectedCount       int64
	ExpectedDeletedRows int64
}

func (f fakeStore) GetUserLoginAttemptCount(ctx context.Context, query GetUserLoginAttemptCountQuery) (int64, error) {
	return f.ExpectedCount, f.ExpectedErr
}

func (f fakeStore) CreateLoginAttempt(ctx context.Context, command CreateLoginAttemptCommand) error {
	return f.ExpectedErr
}

func (f fakeStore) DeleteOldLoginAttempts(ctx context.Context, command DeleteOldLoginAttemptsCommand) (int64, error) {
	return f.ExpectedDeletedRows, f.ExpectedErr
}

func (f fakeStore) DeleteLoginAttempts(ctx context.Context, cmd DeleteLoginAttemptsCommand) error {
	return f.ExpectedErr
}
