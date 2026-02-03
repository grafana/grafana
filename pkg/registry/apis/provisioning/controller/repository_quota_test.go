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

func TestRepositoryQuotaConditions(t *testing.T) {
	tests := []struct {
		name               string
		namespace          string
		maxRepos           int64
		repoCount          int
		expectedStatus     metav1.ConditionStatus
		expectedReason     string
		expectedMessageFmt string
		expectError        bool
	}{
		{
			name:               "unlimited quota (maxRepos = 0)",
			namespace:          "test-ns",
			maxRepos:           0,
			repoCount:          100,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonQuotaUnlimited,
			expectedMessageFmt: "No quota limits configured",
			expectError:        false,
		},
		{
			name:               "under quota (3 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          3,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonWithinQuota,
			expectedMessageFmt: "Within quota: 3/5 repositories",
			expectError:        false,
		},
		{
			name:               "at quota limit (5 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          5,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaReached,
			expectedMessageFmt: "Repository quota reached: 5/5 repositories",
			expectError:        false,
		},
		{
			name:               "over quota (7 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          7,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaExceeded,
			expectedMessageFmt: "Repository quota exceeded: 7/5 repositories",
			expectError:        false,
		},
		{
			name:               "over quota (6 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          6,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaExceeded,
			expectedMessageFmt: "Repository quota exceeded: 6/5 repositories",
			expectError:        false,
		},
		{
			name:               "empty namespace (0 repos)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          0,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonWithinQuota,
			expectedMessageFmt: "Within quota: 0/5 repositories",
			expectError:        false,
		},
		{
			name:               "single repo with limit 1",
			namespace:          "test-ns",
			maxRepos:           1,
			repoCount:          1,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaReached,
			expectedMessageFmt: "Repository quota reached: 1/1 repositories",
			expectError:        false,
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

			mockNamespaceLister := &MockRepositoryNamespaceLister{}
			mockNamespaceLister.On("List", mock.Anything).Return(repos, nil)
			mockRepoLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

			checker := NewRepositoryQuotaChecker(mockRepoLister)

			quotaStatus := provisioning.QuotaStatus{
				MaxRepositories:           tt.maxRepos,
				MaxResourcesPerRepository: 100,
			}

			// Execute
			condition, err := checker.RepositoryQuotaConditions(ctx, tt.namespace, quotaStatus)

			// Assert
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, provisioning.ConditionTypeQuota, condition.Type)
				assert.Equal(t, tt.expectedStatus, condition.Status)
				assert.Equal(t, tt.expectedReason, condition.Reason)
				assert.Equal(t, tt.expectedMessageFmt, condition.Message)
			}
		})
	}
}

func TestRepositoryQuotaConditions_ExcludesDeletingRepos(t *testing.T) {
	ctx := context.Background()
	namespace := "test-ns"

	tests := []struct {
		name               string
		maxRepos           int64
		activeRepos        int
		deletingRepos      int
		expectedStatus     metav1.ConditionStatus
		expectedReason     string
		expectedMessageFmt string
	}{
		{
			name:               "deleting repos excluded from count - under quota",
			maxRepos:           5,
			activeRepos:        3,
			deletingRepos:      5,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonWithinQuota,
			expectedMessageFmt: "Within quota: 3/5 repositories",
		},
		{
			name:               "deleting repos excluded from count - at quota",
			maxRepos:           5,
			activeRepos:        5,
			deletingRepos:      2,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaExceeded,
			expectedMessageFmt: "Repository quota exceeded: 5/5 repositories",
		},
		{
			name:               "deleting repos excluded from count - over quota",
			maxRepos:           5,
			activeRepos:        7,
			deletingRepos:      3,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaReached,
			expectedMessageFmt: "Repository quota reached: 7/5 repositories",
		},
		{
			name:               "all repos being deleted - not over quota",
			maxRepos:           5,
			activeRepos:        0,
			deletingRepos:      10,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonWithinQuota,
			expectedMessageFmt: "Within quota: 0/5 repositories",
		},
		{
			name:               "deletion brings namespace under quota",
			maxRepos:           3,
			activeRepos:        3,
			deletingRepos:      2,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonRepositoryQuotaExceeded,
			expectedMessageFmt: "Repository quota exceeded: 3/3 repositories",
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
			mockNamespaceLister := &MockRepositoryNamespaceLister{}
			mockNamespaceLister.On("List", mock.Anything).Return(repos, nil)
			mockRepoLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

			checker := NewRepositoryQuotaChecker(mockRepoLister)

			quotaStatus := provisioning.QuotaStatus{
				MaxRepositories:           tt.maxRepos,
				MaxResourcesPerRepository: 100,
			}

			// Execute
			condition, err := checker.RepositoryQuotaConditions(ctx, namespace, quotaStatus)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, provisioning.ConditionTypeQuota, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status,
				"Expected status: %v, got: %v (active: %d, deleting: %d, max: %d)",
				tt.expectedStatus, condition.Status, tt.activeRepos, tt.deletingRepos, tt.maxRepos)
			assert.Equal(t, tt.expectedReason, condition.Reason,
				"Expected reason: %s, got: %s (active: %d, deleting: %d, max: %d)",
				tt.expectedReason, condition.Reason, tt.activeRepos, tt.deletingRepos, tt.maxRepos)
			assert.Equal(t, tt.expectedMessageFmt, condition.Message,
				"Expected message: %s, got: %s (active: %d, deleting: %d, max: %d)",
				tt.expectedMessageFmt, condition.Message, tt.activeRepos, tt.deletingRepos, tt.maxRepos)
		})
	}
}
