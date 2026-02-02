package controller

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

// MockQuotaGetter is a mock implementation of quotas.QuotaGetter
type MockQuotaGetter struct {
	mock.Mock
}

func (m *MockQuotaGetter) GetQuotaStatus(ctx context.Context, namespace string) provisioning.QuotaStatus {
	args := m.Called(ctx, namespace)
	return args.Get(0).(provisioning.QuotaStatus)
}

// MockRepositoryNamespaceLister is a mock implementation of listers.RepositoryNamespaceLister
type MockRepositoryNamespaceLister struct {
	mock.Mock
}

func (m *MockRepositoryNamespaceLister) List(selector labels.Selector) ([]*provisioning.Repository, error) {
	args := m.Called(selector)
	return args.Get(0).([]*provisioning.Repository), args.Error(1)
}

func (m *MockRepositoryNamespaceLister) Get(name string) (*provisioning.Repository, error) {
	args := m.Called(name)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*provisioning.Repository), args.Error(1)
}

// MockRepositoryLister is a mock implementation of listers.RepositoryLister
type MockRepositoryLister struct {
	mock.Mock
	namespaceLister *MockRepositoryNamespaceLister
}

func (m *MockRepositoryLister) List(selector labels.Selector) ([]*provisioning.Repository, error) {
	args := m.Called(selector)
	return args.Get(0).([]*provisioning.Repository), args.Error(1)
}

func (m *MockRepositoryLister) Repositories(namespace string) listers.RepositoryNamespaceLister {
	return m.namespaceLister
}

func TestNewRepositoryQuotaChecker(t *testing.T) {
	mockQuotaGetter := &MockQuotaGetter{}
	mockNamespaceLister := &MockRepositoryNamespaceLister{}
	mockRepoLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

	checker := NewRepositoryQuotaChecker(mockQuotaGetter, mockRepoLister)

	assert.NotNil(t, checker)
	assert.Equal(t, mockQuotaGetter, checker.quotaGetter)
	assert.Equal(t, mockRepoLister, checker.repoLister)
}

func TestNamespaceOverQuota(t *testing.T) {
	tests := []struct {
		name           string
		namespace      string
		maxRepos       int64
		repoCount      int
		expectedResult bool
		expectError    bool
	}{
		{
			name:           "unlimited quota (maxRepos = 0)",
			namespace:      "test-ns",
			maxRepos:       0,
			repoCount:      100,
			expectedResult: false,
			expectError:    false,
		},
		{
			name:           "under quota (3 of 5)",
			namespace:      "test-ns",
			maxRepos:       5,
			repoCount:      3,
			expectedResult: false,
			expectError:    false,
		},
		{
			name:           "at quota limit (5 of 5)",
			namespace:      "test-ns",
			maxRepos:       5,
			repoCount:      5,
			expectedResult: false,
			expectError:    false,
		},
		{
			name:           "over quota (7 of 5)",
			namespace:      "test-ns",
			maxRepos:       5,
			repoCount:      7,
			expectedResult: true,
			expectError:    false,
		},
		{
			name:           "over quota (6 of 5)",
			namespace:      "test-ns",
			maxRepos:       5,
			repoCount:      6,
			expectedResult: true,
			expectError:    false,
		},
		{
			name:           "empty namespace (0 repos)",
			namespace:      "test-ns",
			maxRepos:       5,
			repoCount:      0,
			expectedResult: false,
			expectError:    false,
		},
		{
			name:           "single repo with limit 1",
			namespace:      "test-ns",
			maxRepos:       1,
			repoCount:      1,
			expectedResult: false,
			expectError:    false,
		},
		{
			name:           "two repos with limit 1",
			namespace:      "test-ns",
			maxRepos:       1,
			repoCount:      2,
			expectedResult: true,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Create mock repositories
			repos := make([]*provisioning.Repository, tt.repoCount)
			for i := 0; i < tt.repoCount; i++ {
				repos[i] = &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("repo-%d", i),
						Namespace: tt.namespace,
					},
				}
			}

			// Setup mocks
			mockQuotaGetter := &MockQuotaGetter{}
			mockQuotaGetter.On("GetQuotaStatus", ctx, tt.namespace).Return(
				provisioning.QuotaStatus{
					MaxRepositories:           tt.maxRepos,
					MaxResourcesPerRepository: 100,
				},
			)

			mockNamespaceLister := &MockRepositoryNamespaceLister{}
			mockNamespaceLister.On("List", mock.Anything).Return(repos, nil)
			mockRepoLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

			checker := NewRepositoryQuotaChecker(mockQuotaGetter, mockRepoLister)

			// Execute
			result, err := checker.NamespaceOverQuota(ctx, tt.namespace)

			// Assert
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			mockQuotaGetter.AssertExpectations(t)
		})
	}
}

func TestNamespaceOverQuota_ExcludesDeletingRepos(t *testing.T) {
	ctx := context.Background()
	namespace := "test-ns"

	tests := []struct {
		name              string
		maxRepos          int64
		activeRepos       int
		deletingRepos     int
		expectedOverQuota bool
	}{
		{
			name:              "deleting repos excluded from count - under quota",
			maxRepos:          5,
			activeRepos:       3,
			deletingRepos:     5,
			expectedOverQuota: false,
		},
		{
			name:              "deleting repos excluded from count - at quota",
			maxRepos:          5,
			activeRepos:       5,
			deletingRepos:     2,
			expectedOverQuota: false,
		},
		{
			name:              "deleting repos excluded from count - over quota",
			maxRepos:          5,
			activeRepos:       7,
			deletingRepos:     3,
			expectedOverQuota: true,
		},
		{
			name:              "all repos being deleted - not over quota",
			maxRepos:          5,
			activeRepos:       0,
			deletingRepos:     10,
			expectedOverQuota: false,
		},
		{
			name:              "deletion brings namespace under quota",
			maxRepos:          3,
			activeRepos:       3,
			deletingRepos:     2,
			expectedOverQuota: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create active repositories (no DeletionTimestamp)
			repos := make([]*provisioning.Repository, 0, tt.activeRepos+tt.deletingRepos)
			for i := 0; i < tt.activeRepos; i++ {
				repos = append(repos, &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("active-repo-%d", i),
						Namespace: namespace,
					},
				})
			}

			// Create deleting repositories (with DeletionTimestamp)
			deletionTime := metav1.Now()
			for i := 0; i < tt.deletingRepos; i++ {
				repos = append(repos, &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:              fmt.Sprintf("deleting-repo-%d", i),
						Namespace:         namespace,
						DeletionTimestamp: &deletionTime,
					},
				})
			}

			// Setup mocks
			mockQuotaGetter := &MockQuotaGetter{}
			mockQuotaGetter.On("GetQuotaStatus", ctx, namespace).Return(
				provisioning.QuotaStatus{
					MaxRepositories:           tt.maxRepos,
					MaxResourcesPerRepository: 100,
				},
			)

			mockNamespaceLister := &MockRepositoryNamespaceLister{}
			mockNamespaceLister.On("List", mock.Anything).Return(repos, nil)
			mockRepoLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

			checker := NewRepositoryQuotaChecker(mockQuotaGetter, mockRepoLister)

			// Execute
			result, err := checker.NamespaceOverQuota(ctx, namespace)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, tt.expectedOverQuota, result,
				"Expected over quota: %v, got: %v (active: %d, deleting: %d, max: %d)",
				tt.expectedOverQuota, result, tt.activeRepos, tt.deletingRepos, tt.maxRepos)

			mockQuotaGetter.AssertExpectations(t)
		})
	}
}
