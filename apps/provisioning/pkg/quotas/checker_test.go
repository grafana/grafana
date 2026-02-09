package quotas

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// fakeResourceCounter is a test double for the ResourceCounter interface.
type fakeResourceCounter struct {
	count int64
	err   error
}

func (f *fakeResourceCounter) Count(_ context.Context, _, _ string) (int64, error) {
	if f.err != nil {
		return 0, f.err
	}
	return f.count, nil
}

func TestQuotaCheckerFactory_GetQuotaChecker(t *testing.T) {
	tests := []struct {
		name         string
		maxResources int64
		count        int64
		countErr     error
		expectErr    bool
		expectErrMsg string
	}{
		{
			name:         "within quota returns checker",
			maxResources: 100,
			count:        50,
		},
		{
			name:         "unlimited quota returns checker",
			maxResources: 0,
			count:        9999,
		},
		{
			name:         "stats error propagates",
			maxResources: 100,
			countErr:     fmt.Errorf("storage unavailable"),
			expectErr:    true,
			expectErrMsg: "get resource stats for quota check",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			counter := &fakeResourceCounter{count: tt.count, err: tt.countErr}
			factory := NewQuotaCheckerFactory(counter)
			quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: tt.maxResources}

			checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
			if tt.expectErr {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectErrMsg)
				return
			}
			require.NoError(t, err)
			require.NotNil(t, checker)
		})
	}
}

func TestGrantResourceCreation(t *testing.T) {
	tests := []struct {
		name          string
		maxResources  int64
		currentCount  int64
		expectErr     error
		expectCreated bool
	}{
		{
			name:          "within quota allows creation",
			maxResources:  100,
			currentCount:  50,
			expectCreated: true,
		},
		{
			name:         "at quota limit denies creation",
			maxResources: 100,
			currentCount: 100,
			expectErr:    ErrQuotaExceeded,
		},
		{
			name:         "over quota denies creation",
			maxResources: 100,
			currentCount: 150,
			expectErr:    ErrQuotaExceeded,
		},
		{
			name:          "unlimited quota (0) allows creation",
			maxResources:  0,
			currentCount:  9999,
			expectCreated: true,
		},
		{
			name:          "empty stats allows creation",
			maxResources:  100,
			currentCount:  0,
			expectCreated: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			counter := &fakeResourceCounter{count: tt.currentCount}
			factory := NewQuotaCheckerFactory(counter)
			quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: tt.maxResources}

			checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
			require.NoError(t, err)

			created := false
			err = checker.GrantResourceCreation(ctx, func() error {
				created = true
				return nil
			})

			if tt.expectErr != nil {
				require.ErrorIs(t, err, tt.expectErr)
				assert.False(t, created, "createFn should not be called when quota is exceeded")
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectCreated, created)
			}
		})
	}
}

func TestGrantResourceCreation_FailedCreation(t *testing.T) {
	ctx := context.Background()
	counter := &fakeResourceCounter{count: 98}
	factory := NewQuotaCheckerFactory(counter)
	quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: 100}

	checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
	require.NoError(t, err)

	createErr := errors.New("create failed")

	// First call: createFn fails — grant should be released, usage NOT incremented
	err = checker.GrantResourceCreation(ctx, func() error {
		return createErr
	})
	require.ErrorIs(t, err, createErr)

	// Second call: should still succeed since the failed grant was released
	created := false
	err = checker.GrantResourceCreation(ctx, func() error {
		created = true
		return nil
	})
	require.NoError(t, err)
	assert.True(t, created, "grant should be available after a failed creation")

	// Third call: also succeeds (usage was 98 → 99 after second call)
	created = false
	err = checker.GrantResourceCreation(ctx, func() error {
		created = true
		return nil
	})
	require.NoError(t, err)
	assert.True(t, created)

	// Fourth call: should fail (usage is now 100, at the limit)
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.ErrorIs(t, err, ErrQuotaExceeded)
}

func TestGrantResourceCreation_FailedCreationAtLimit(t *testing.T) {
	ctx := context.Background()
	counter := &fakeResourceCounter{count: 99}
	factory := NewQuotaCheckerFactory(counter)
	quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: 100}

	checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
	require.NoError(t, err)

	createErr := errors.New("create failed")

	// At 99/100 — grant is available, but createFn fails
	err = checker.GrantResourceCreation(ctx, func() error {
		return createErr
	})
	require.ErrorIs(t, err, createErr)

	// The grant should have been released, so the slot is still free
	created := false
	err = checker.GrantResourceCreation(ctx, func() error {
		created = true
		return nil
	})
	require.NoError(t, err)
	assert.True(t, created, "slot should still be available after failed creation")
}

func TestGrantResourceCreation_SequentialGrants(t *testing.T) {
	ctx := context.Background()
	counter := &fakeResourceCounter{count: 99}
	factory := NewQuotaCheckerFactory(counter)
	quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: 100}

	checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
	require.NoError(t, err)

	// First grant should succeed (99/100 → 100/100)
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.NoError(t, err)

	// Second grant should fail (100/100, at the limit)
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.ErrorIs(t, err, ErrQuotaExceeded)
}

func TestOnResourceDeleted(t *testing.T) {
	ctx := context.Background()
	counter := &fakeResourceCounter{count: 100}
	factory := NewQuotaCheckerFactory(counter)
	quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: 100}

	checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
	require.NoError(t, err)

	// At limit — creation should be denied
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.ErrorIs(t, err, ErrQuotaExceeded)

	// Delete one resource
	err = checker.OnResourceDeleted(ctx)
	require.NoError(t, err)

	// Now creation should succeed (99/100)
	created := false
	err = checker.GrantResourceCreation(ctx, func() error {
		created = true
		return nil
	})
	require.NoError(t, err)
	assert.True(t, created)
}

func TestOnResourceDeleted_NeverNegative(t *testing.T) {
	ctx := context.Background()
	counter := &fakeResourceCounter{count: 0}
	factory := NewQuotaCheckerFactory(counter)
	quotaStatus := provisioning.QuotaStatus{MaxResourcesPerRepository: 100}

	checker, err := factory.GetQuotaChecker(ctx, quotaStatus, "test-ns", "my-repo")
	require.NoError(t, err)

	// Delete when already at 0 should not go negative
	err = checker.OnResourceDeleted(ctx)
	require.NoError(t, err)

	// Should still be able to create
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.NoError(t, err)
}

func TestUnlimitedQuotaChecker(t *testing.T) {
	ctx := context.Background()
	factory := NewUnlimitedQuotaCheckerFactory()

	checker, err := factory.GetQuotaChecker(ctx, provisioning.QuotaStatus{}, "test-ns", "my-repo")
	require.NoError(t, err)
	require.NotNil(t, checker)

	// Always allows creation
	created := false
	err = checker.GrantResourceCreation(ctx, func() error {
		created = true
		return nil
	})
	require.NoError(t, err)
	assert.True(t, created)

	// Propagates createFn errors
	createErr := errors.New("create failed")
	err = checker.GrantResourceCreation(ctx, func() error {
		return createErr
	})
	require.ErrorIs(t, err, createErr)

	// OnResourceDeleted is a no-op
	err = checker.OnResourceDeleted(ctx)
	require.NoError(t, err)
}

func TestQuotaCheckerFactory_ImplementsInterface(t *testing.T) {
	counter := &fakeResourceCounter{count: 0}

	var factory QuotaCheckerFactory = NewQuotaCheckerFactory(counter)
	require.NotNil(t, factory)
}
