package quotas

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewUnlimitedQuotaChecker(t *testing.T) {
	checker := NewUnlimitedQuotaChecker()
	require.NotNil(t, checker)
	require.IsType(t, &UnlimitedQuotaChecker{}, checker)
}

func TestUnlimitedQuotaChecker_GrantResourceCreation(t *testing.T) {
	checker := NewUnlimitedQuotaChecker()
	ctx := context.Background()

	// Test successful creation
	called := false
	err := checker.GrantResourceCreation(ctx, func() error {
		called = true
		return nil
	})
	require.NoError(t, err)
	require.True(t, called)

	// Test with error from create function
	expectedErr := errors.New("create failed")
	err = checker.GrantResourceCreation(ctx, func() error {
		return expectedErr
	})
	require.Error(t, err)
	require.Equal(t, expectedErr, err)
}

func TestUnlimitedQuotaChecker_OnResourceDeleted(t *testing.T) {
	checker := NewUnlimitedQuotaChecker()
	ctx := context.Background()

	err := checker.OnResourceDeleted(ctx)
	require.NoError(t, err)
}

func TestNewFixedLimitQuotaChecker(t *testing.T) {
	tests := []struct {
		name         string
		quotaUsage   Usage
		quotaStatus  provisioning.QuotaStatus
		expectedFree int64
	}{
		{
			name:         "empty usage, limit 10",
			quotaUsage:   Usage{TotalResources: 0},
			quotaStatus:  provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedFree: 10,
		},
		{
			name:         "partial usage, limit 10",
			quotaUsage:   Usage{TotalResources: 3},
			quotaStatus:  provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedFree: 7,
		},
		{
			name:         "at limit, limit 10",
			quotaUsage:   Usage{TotalResources: 10},
			quotaStatus:  provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedFree: 0,
		},
		{
			name:         "over limit, limit 10",
			quotaUsage:   Usage{TotalResources: 15},
			quotaStatus:  provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedFree: 0, // min(10-15, 0) = 0
		},
		{
			name:         "limit 0",
			quotaUsage:   Usage{TotalResources: 0},
			quotaStatus:  provisioning.QuotaStatus{MaxResourcesPerRepository: 0},
			expectedFree: 0, // min(0-0, 0) = 0
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checker := NewFixedLimitQuotaChecker(tt.quotaUsage, tt.quotaStatus).(*fixedLimitQuotaChecker)
			assert.Equal(t, int64(0), checker.granted)
			assert.Equal(t, tt.quotaUsage, checker.quotaUsage)
			assert.Equal(t, tt.quotaStatus, checker.quotaStatus)
		})
	}
}

func TestFixedLimitQuotaChecker_GrantResourceCreation_UnderLimit(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 5},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()
	called := false

	err := checker.GrantResourceCreation(ctx, func() error {
		called = true
		return nil
	})

	require.NoError(t, err)
	assert.True(t, called)
	assert.Equal(t, int64(0), checker.granted)                   // granted was decremented after success
	assert.Equal(t, int64(6), checker.quotaUsage.TotalResources) // 5 -> 6 after creation
}

func TestFixedLimitQuotaChecker_GrantResourceCreation_AtLimit(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 10},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()

	err := checker.GrantResourceCreation(ctx, func() error {
		return nil
	})

	require.Error(t, err)
	assert.Equal(t, ErrQuotaExceeded, err)
	assert.Equal(t, int64(0), checker.granted)
	assert.Equal(t, int64(10), checker.quotaUsage.TotalResources) // unchanged
}

func TestFixedLimitQuotaChecker_GrantResourceCreation_OverLimit(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 15},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()

	err := checker.GrantResourceCreation(ctx, func() error {
		return nil
	})

	require.Error(t, err)
	assert.Equal(t, ErrQuotaExceeded, err)
	assert.Equal(t, int64(0), checker.granted)
	assert.Equal(t, int64(15), checker.quotaUsage.TotalResources) // unchanged
}

func TestFixedLimitQuotaChecker_GrantResourceCreation_LimitZero(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 0},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 0},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()

	err := checker.GrantResourceCreation(ctx, func() error {
		return nil
	})

	require.Error(t, err)
	assert.Equal(t, ErrQuotaExceeded, err)
	assert.Equal(t, int64(0), checker.granted)
	assert.Equal(t, int64(0), checker.quotaUsage.TotalResources)
}

func TestFixedLimitQuotaChecker_GrantResourceCreation_CreateFunctionFails(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 5},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()
	expectedErr := errors.New("creation failed")

	err := checker.GrantResourceCreation(ctx, func() error {
		return expectedErr
	})

	require.Error(t, err)
	assert.Equal(t, expectedErr, err)
	// Grant should be canceled, so free should be restored
	assert.Equal(t, int64(0), checker.granted)
	assert.Equal(t, int64(5), checker.quotaUsage.TotalResources) // unchanged
}

func TestFixedLimitQuotaChecker_GrantResourceCreation_MultipleGrants(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 0},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 3},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()

	// Grant first resource
	err := checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, int64(1), checker.quotaUsage.TotalResources)

	// Grant second resource
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, int64(2), checker.quotaUsage.TotalResources)

	// Grant third resource (at limit)
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.NoError(t, err)
	assert.Equal(t, int64(3), checker.quotaUsage.TotalResources)

	// Try to grant fourth resource (should fail)
	err = checker.GrantResourceCreation(ctx, func() error {
		return nil
	})
	require.Error(t, err)
	assert.Equal(t, ErrQuotaExceeded, err)
	assert.Equal(t, int64(3), checker.quotaUsage.TotalResources) // unchanged
}

func TestFixedLimitQuotaChecker_OnResourceDeleted(t *testing.T) {
	tests := []struct {
		name          string
		initialUsage  Usage
		quotaStatus   provisioning.QuotaStatus
		expectedUsage int64
	}{
		{
			name:          "delete when under limit",
			initialUsage:  Usage{TotalResources: 5},
			quotaStatus:   provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedUsage: 4,
		},
		{
			name:          "delete when at limit",
			initialUsage:  Usage{TotalResources: 10},
			quotaStatus:   provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedUsage: 9,
		},
		{
			name:          "delete when over limit",
			initialUsage:  Usage{TotalResources: 15},
			quotaStatus:   provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedUsage: 14,
		},
		{
			name:          "delete when at max free",
			initialUsage:  Usage{TotalResources: 0},
			quotaStatus:   provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedUsage: 0,
		},
		{
			name:          "delete with limit 0",
			initialUsage:  Usage{TotalResources: 1},
			quotaStatus:   provisioning.QuotaStatus{MaxResourcesPerRepository: 0},
			expectedUsage: 0,
		},
		{
			name:          "delete when usage is 0",
			initialUsage:  Usage{TotalResources: 0},
			quotaStatus:   provisioning.QuotaStatus{MaxResourcesPerRepository: 10},
			expectedUsage: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checker := NewFixedLimitQuotaChecker(tt.initialUsage, tt.quotaStatus).(*fixedLimitQuotaChecker)
			checker.quotaUsage.TotalResources = tt.initialUsage.TotalResources

			ctx := context.Background()
			err := checker.OnResourceDeleted(ctx)

			require.NoError(t, err)
			assert.Equal(t, tt.expectedUsage, checker.quotaUsage.TotalResources)
		})
	}
}

func TestFixedLimitQuotaChecker_ConcurrentGrantResourceCreation(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 0},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 5},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()
	var wg sync.WaitGroup
	successCount := int64(0)
	var successMu sync.Mutex
	errorCount := int64(0)
	var errorMu sync.Mutex

	// Try to create 10 resources concurrently (but only 5 should succeed)
	numGoroutines := 10
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			defer wg.Done()
			err := checker.GrantResourceCreation(ctx, func() error {
				// Simulate some work
				time.Sleep(1 * time.Millisecond)
				return nil
			})
			if err != nil {
				errorMu.Lock()
				errorCount++
				errorMu.Unlock()
			} else {
				successMu.Lock()
				successCount++
				successMu.Unlock()
			}
		}()
	}

	wg.Wait()

	// Exactly 5 should succeed (the limit)
	assert.Equal(t, int64(5), successCount)
	assert.Equal(t, int64(5), errorCount)
	assert.Equal(t, int64(0), checker.granted)
	assert.Equal(t, int64(5), checker.quotaUsage.TotalResources)
}

func TestFixedLimitQuotaChecker_ConcurrentGrantAndDelete(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 0},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 3},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()
	var wg sync.WaitGroup

	// Create 3 resources first
	for i := 0; i < 3; i++ {
		err := checker.GrantResourceCreation(ctx, func() error {
			return nil
		})
		require.NoError(t, err)
	}

	// Now concurrently delete and create
	numOperations := 20
	wg.Add(numOperations)

	for i := 0; i < numOperations; i++ {
		go func(operation int) {
			defer wg.Done()
			if operation%2 == 0 {
				// Delete operation
				_ = checker.OnResourceDeleted(ctx)
			} else {
				// Create operation
				_ = checker.GrantResourceCreation(ctx, func() error {
					return nil
				})
			}
		}(i)
	}

	wg.Wait()

	// Final state should be consistent (no negative values)
	assert.GreaterOrEqual(t, checker.quotaUsage.TotalResources, int64(0))
	assert.Equal(t, int64(0), checker.granted) // All grants should be resolved
}

func TestFixedLimitQuotaChecker_ConcurrentGrantWithFailures(t *testing.T) {
	checker := NewFixedLimitQuotaChecker(
		Usage{TotalResources: 0},
		provisioning.QuotaStatus{MaxResourcesPerRepository: 3},
	).(*fixedLimitQuotaChecker)

	ctx := context.Background()
	var wg sync.WaitGroup
	successCount := int64(0)
	var successMu sync.Mutex
	errorCount := int64(0)
	var errorMu sync.Mutex

	// Try to create 10 resources concurrently, but some will fail
	numGoroutines := 10
	wg.Add(numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			err := checker.GrantResourceCreation(ctx, func() error {
				// Simulate some work
				time.Sleep(1 * time.Millisecond)
				// Every 3rd creation fails
				if id%3 == 0 {
					return errors.New("creation failed")
				}
				return nil
			})
			if err != nil {
				errorMu.Lock()
				errorCount++
				errorMu.Unlock()
			} else {
				successMu.Lock()
				successCount++
				successMu.Unlock()
			}
		}(i)
	}

	wg.Wait()

	// State should be consistent
	assert.Equal(t, int64(0), checker.granted) // All grants should be resolved
	// Total resources should be <= limit
	assert.LessOrEqual(t, checker.quotaUsage.TotalResources, checker.quotaStatus.MaxResourcesPerRepository)
}

// mockResourceLister is a simple mock implementation of ResourceLister for testing
type mockResourceLister struct {
	statsFunc func(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error)
}

func (m *mockResourceLister) Stats(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error) {
	if m.statsFunc != nil {
		return m.statsFunc(ctx, namespace, repository)
	}
	return &provisioning.ResourceStats{}, nil
}

func TestNewRepositoryQuotaCheckerFactory(t *testing.T) {
	lister := &mockResourceLister{}
	factory := NewRepositoryQuotaCheckerFactory(lister)
	require.NotNil(t, factory)
	require.IsType(t, &repositoryQuotaCheckerFactory{}, factory)
}

func TestRepositoryQuotaCheckerFactory_GetQuotaChecker_Unlimited(t *testing.T) {
	ctx := context.Background()
	lister := &mockResourceLister{}
	factory := NewRepositoryQuotaCheckerFactory(lister)

	mockRepo := &repository.MockReader{}
	repoConfig := &provisioning.Repository{
		Status: provisioning.RepositoryStatus{
			Quota: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 0, // unlimited
			},
		},
	}
	repoConfig.SetNamespace("test-namespace")
	repoConfig.SetName("test-repo")
	mockRepo.On("Config").Return(repoConfig)

	checker, err := factory.GetQuotaChecker(ctx, mockRepo)
	require.NoError(t, err)
	require.NotNil(t, checker)
	require.IsType(t, &UnlimitedQuotaChecker{}, checker)
	mockRepo.AssertExpectations(t)
}

func TestRepositoryQuotaCheckerFactory_GetQuotaChecker_WithLimit(t *testing.T) {
	ctx := context.Background()
	namespace := "test-namespace"
	repoName := "test-repo"

	lister := &mockResourceLister{
		statsFunc: func(ctx context.Context, ns, repo string) (*provisioning.ResourceStats, error) {
			assert.Equal(t, namespace, ns)
			assert.Equal(t, repoName, repo)
			return &provisioning.ResourceStats{
				Managed: []provisioning.ManagerStats{
					{
						Kind:     "repo",
						Identity: repoName,
						Stats: []provisioning.ResourceCount{
							{Group: "dashboard.grafana.app", Resource: "dashboard", Count: 3},
							{Group: "folder.grafana.app", Resource: "folder", Count: 2},
						},
					},
				},
			}, nil
		},
	}
	factory := NewRepositoryQuotaCheckerFactory(lister)

	mockRepo := &repository.MockReader{}
	repoConfig := &provisioning.Repository{
		Status: provisioning.RepositoryStatus{
			Quota: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 10,
			},
		},
	}
	repoConfig.SetNamespace(namespace)
	repoConfig.SetName(repoName)
	mockRepo.On("Config").Return(repoConfig)

	checker, err := factory.GetQuotaChecker(ctx, mockRepo)
	require.NoError(t, err)
	require.NotNil(t, checker)
	require.IsType(t, &fixedLimitQuotaChecker{}, checker)

	fixedChecker := checker.(*fixedLimitQuotaChecker)
	assert.Equal(t, int64(5), fixedChecker.quotaUsage.TotalResources) // 3 + 2
	assert.Equal(t, int64(10), fixedChecker.quotaStatus.MaxResourcesPerRepository)
	mockRepo.AssertExpectations(t)
}

func TestRepositoryQuotaCheckerFactory_GetQuotaChecker_StatsError(t *testing.T) {
	ctx := context.Background()
	expectedErr := errors.New("stats error")

	lister := &mockResourceLister{
		statsFunc: func(ctx context.Context, namespace, repository string) (*provisioning.ResourceStats, error) {
			return nil, expectedErr
		},
	}
	factory := NewRepositoryQuotaCheckerFactory(lister)

	mockRepo := &repository.MockReader{}
	repoConfig := &provisioning.Repository{
		Status: provisioning.RepositoryStatus{
			Quota: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 10,
			},
		},
	}
	repoConfig.SetNamespace("test-namespace")
	repoConfig.SetName("test-repo")
	mockRepo.On("Config").Return(repoConfig)

	checker, err := factory.GetQuotaChecker(ctx, mockRepo)
	require.Error(t, err)
	require.Equal(t, expectedErr, err)
	require.Nil(t, checker)
	mockRepo.AssertExpectations(t)
}

func TestRepositoryQuotaCheckerFactory_GetQuotaChecker_NoMatchingManager(t *testing.T) {
	ctx := context.Background()
	namespace := "test-namespace"
	repoName := "test-repo"

	lister := &mockResourceLister{
		statsFunc: func(ctx context.Context, ns, repo string) (*provisioning.ResourceStats, error) {
			return &provisioning.ResourceStats{
				Managed: []provisioning.ManagerStats{
					{
						Kind:     "repo",
						Identity: "other-repo",
						Stats:    []provisioning.ResourceCount{},
					},
				},
			}, nil
		},
	}
	factory := NewRepositoryQuotaCheckerFactory(lister)

	mockRepo := &repository.MockReader{}
	repoConfig := &provisioning.Repository{
		Status: provisioning.RepositoryStatus{
			Quota: provisioning.QuotaStatus{
				MaxResourcesPerRepository: 10,
			},
		},
	}
	repoConfig.SetNamespace(namespace)
	repoConfig.SetName(repoName)
	mockRepo.On("Config").Return(repoConfig)

	checker, err := factory.GetQuotaChecker(ctx, mockRepo)
	require.NoError(t, err)
	require.NotNil(t, checker)
	require.IsType(t, &fixedLimitQuotaChecker{}, checker)

	fixedChecker := checker.(*fixedLimitQuotaChecker)
	assert.Equal(t, int64(0), fixedChecker.quotaUsage.TotalResources) // no matching manager
	assert.Equal(t, int64(10), fixedChecker.quotaStatus.MaxResourcesPerRepository)
	mockRepo.AssertExpectations(t)
}
