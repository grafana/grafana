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
	repos []*provisioning.Repository
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

