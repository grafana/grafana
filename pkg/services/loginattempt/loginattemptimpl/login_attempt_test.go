package loginattemptimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
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
			name:          "Should be valid when brute force protection enabled and user login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "Should be invalid when brute force protection enabled and user login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			expected:      false,
			expectedErr:   nil,
		},
		{
			name:          "Should be invalid when brute force protection enabled and user login attempt count is greater than max",
			loginAttempts: maxInvalidLoginAttempts + 1,
			expected:      false,
			expectedErr:   nil,
		},

		{
			name:          "Should be valid when brute force protection disabled and user login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "Should be valid when brute force protection disabled and user login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "Should be valid when brute force protection disabled and user login attempt count is greater than max",
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
			cfg.DisableUsernameLoginProtection = tt.disabled
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

func TestIntegrationUserLoginAttempts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	cfg := setting.NewCfg()
	cfg.DisableUsernameLoginProtection = false
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

func TestService_ValidateIPAddress(t *testing.T) {
	const maxInvalidLoginAttempts = 5

	testCases := []struct {
		name          string
		loginAttempts int64
		disabled      bool
		expected      bool
		expectedErr   error
	}{
		{
			name:          "Should be valid when brute force protection enabled and IP address login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "Should be invalid when brute force protection enabled and IP address login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			expected:      false,
			expectedErr:   nil,
		},
		{
			name:          "Should be invalid when brute force protection enabled and IP address login attempt count is greater than max",
			loginAttempts: maxInvalidLoginAttempts + 1,
			expected:      false,
			expectedErr:   nil,
		},

		{
			name:          "Should be valid when brute force protection disabled and IP address login attempt count is less than max",
			loginAttempts: maxInvalidLoginAttempts - 1,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "Should be valid when brute force protection disabled and IP address login attempt count equals max",
			loginAttempts: maxInvalidLoginAttempts,
			disabled:      true,
			expected:      true,
			expectedErr:   nil,
		},
		{
			name:          "Should be valid when brute force protection disabled and IP address login attempt count is greater than max",
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
			cfg.DisableIPAddressLoginProtection = tt.disabled
			service := &Service{
				store: fakeStore{
					ExpectedCount: tt.loginAttempts,
					ExpectedErr:   tt.expectedErr,
				},
				cfg: cfg,
			}

			ok, err := service.ValidateIPAddress(context.Background(), "192.168.1.1")
			assert.Equal(t, tt.expected, ok)
			assert.Equal(t, tt.expectedErr, err)
		})
	}
}

func TestIntegrationIPLoginAttempts(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	cfg := setting.NewCfg()
	cfg.DisableIPAddressLoginProtection = false
	cfg.BruteForceLoginProtectionMaxAttempts = 3
	db := db.InitTestDB(t)
	service := ProvideService(db, cfg, nil)

	_ = service.Add(ctx, "user1", "192.168.1.1")
	_ = service.Add(ctx, "user2", "10.0.0.123")
	_ = service.Add(ctx, "user3", "192.168.1.1")
	_ = service.Add(ctx, "user4", "[::1]")
	_ = service.Add(ctx, "user5", "192.168.1.1")
	_ = service.Add(ctx, "user6", "192.168.1.1")

	count, err := service.store.GetIPLoginAttemptCount(ctx, GetIPLoginAttemptCountQuery{IPAddress: "192.168.1.1"})
	assert.Nil(t, err)
	assert.Equal(t, int64(4), count)

	ok, err := service.ValidateIPAddress(ctx, "192.168.1.1")
	assert.False(t, ok)
	assert.Nil(t, err)
}

// TestIPv6AddressSupport verifies that various IPv6 address formats can be stored properly with the new column length, testing various IPv6 address formats that could be encountered.
// This test validates that the ip_address column length is sufficient for IPv6 addresses
func TestIntegrationIPv6AddressSupport(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := context.Background()
	cfg := setting.NewCfg()
	cfg.DisableBruteForceLoginProtection = false
	cfg.BruteForceLoginProtectionMaxAttempts = 5

	// Use controlled time like other tests to avoid timestamp conversion issues
	testTime := time.Date(2023, 10, 22, 8, 0, 0, 0, time.UTC)
	store := &xormStore{
		db:  db.InitTestDB(t),
		now: func() time.Time { return testTime },
	}
	service := &Service{
		store:  store,
		cfg:    cfg,
		logger: log.New("test.login_attempt"),
	}

	// Test various IPv6 address formats that should be supported
	ipv6Addresses := []string{
		"::1",           // loopback (3 chars)
		"2001:db8::1",   // shortened (12 chars)
		"[::1]",         // bracketed loopback (5 chars)
		"[2001:db8::1]", // bracketed shortened (14 chars)
		"2001:0db8:85a3:0000:0000:8a2e:0370:7334",   // full IPv6 (39 chars)
		"[2001:0db8:85a3:0000:0000:8a2e:0370:7334]", // bracketed full IPv6 (41 chars)
		"2001:db8:85a3:8d3:1319:8a2e:370:7348",      // mixed case (34 chars)
		"[2001:db8:85a3:8d3:1319:8a2e:370:7348]",    // bracketed mixed (36 chars)
		"aaaa:79c0:647:bd00:4c59:2f13:3da6:aaaa",    // from the GitHub issue (35 chars)
		"[aaaa:79c0:647:bd00:4c59:2f13:3da6:aaaa]",  // bracketed from issue (37 chars)
	}

	for i, ipAddress := range ipv6Addresses {
		t.Run("IPv6_Address_"+ipAddress, func(t *testing.T) {
			username := fmt.Sprintf("testuser%d", i)

			// Verify that the address length is within our new limit of 50 characters
			assert.LessOrEqual(t, len(ipAddress), 50, "IP address should fit in VARCHAR(50)")

			// Test that we can add login attempts with this IPv6 address
			err := service.Add(ctx, username, ipAddress)
			assert.NoError(t, err, "Should be able to add login attempt with IPv6 address: %s", ipAddress)

			// Verify that the login attempt was stored correctly
			count, err := store.GetIPLoginAttemptCount(ctx, GetIPLoginAttemptCountQuery{
				IPAddress: ipAddress,
				Since:     testTime.Add(-time.Minute * 5),
			})
			assert.NoError(t, err, "Should be able to query login attempts for IPv6 address: %s", ipAddress)
			assert.Equal(t, int64(1), count, "Should have 1 login attempt for IPv6 address: %s", ipAddress)

			// Test IP-based validation
			ok, err := service.ValidateIPAddress(ctx, ipAddress)
			assert.NoError(t, err, "Should be able to validate IPv6 address: %s", ipAddress)
			assert.True(t, ok, "IPv6 address should be valid: %s", ipAddress)
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

func (f fakeStore) GetIPLoginAttemptCount(ctx context.Context, query GetIPLoginAttemptCountQuery) (int64, error) {
	return f.ExpectedCount, f.ExpectedErr
}

func (f fakeStore) CreateLoginAttempt(ctx context.Context, command CreateLoginAttemptCommand) (loginattempt.LoginAttempt, error) {
	return loginattempt.LoginAttempt{}, f.ExpectedErr
}

func (f fakeStore) DeleteOldLoginAttempts(ctx context.Context, command DeleteOldLoginAttemptsCommand) (int64, error) {
	return f.ExpectedDeletedRows, f.ExpectedErr
}

func (f fakeStore) DeleteLoginAttempts(ctx context.Context, command DeleteLoginAttemptsCommand) error {
	return f.ExpectedErr
}
