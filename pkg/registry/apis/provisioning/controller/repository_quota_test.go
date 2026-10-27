package controller

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/fake"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
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
			expectedMessageFmt: "within quota: 3/5 repositories",
			expectError:        false,
		},
		{
			name:               "at quota limit (5 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          5,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonQuotaReached,
			expectedMessageFmt: "namespace quota reached: 5/5 repositories",
			expectError:        false,
		},
		{
			name:               "over quota (7 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          7,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 7/5 repositories",
			expectError:        false,
		},
		{
			name:               "over quota (6 of 5)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          6,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 6/5 repositories",
			expectError:        false,
		},
		{
			name:               "empty namespace (0 repos)",
			namespace:          "test-ns",
			maxRepos:           5,
			repoCount:          0,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonWithinQuota,
			expectedMessageFmt: "within quota: 0/5 repositories",
			expectError:        false,
		},
		{
			name:               "single repo with limit 1",
			namespace:          "test-ns",
			maxRepos:           1,
			repoCount:          1,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonQuotaReached,
			expectedMessageFmt: "namespace quota reached: 1/1 repositories",
			expectError:        false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Create mock repositories
			repos := make([]*provisioning.Repository, tt.repoCount)
			for i := range tt.repoCount {
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

			checker := NewRepositoryQuotaChecker(informer.NewCachedRepositoryGetter(mockRepoLister))

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
				assert.Equal(t, provisioning.ConditionTypeNamespaceQuota, condition.Type)
				assert.Equal(t, tt.expectedStatus, condition.Status)
				assert.Equal(t, tt.expectedReason, condition.Reason)
				assert.Equal(t, tt.expectedMessageFmt, condition.Message)
			}
		})
	}
}

// A repository awaiting its finalizers still counts: the NATS informer's store
// holds identities only, so it cannot tell a deleting repository apart, and both
// getters have to agree. Most of these cases are false positives, a namespace
// reported at or over quota only because of deletions in flight. They pin that
// cost; once the store can carry the deletion state again, excluding deleting
// repositories flips them back.
func TestRepositoryQuotaConditions_CountsDeletingRepos(t *testing.T) {
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
			name:               "deleting repos push the namespace from under to over quota",
			maxRepos:           5,
			activeRepos:        3,
			deletingRepos:      5,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 8/5 repositories",
		},
		{
			name:               "deleting repos push the namespace from at to over quota",
			maxRepos:           5,
			activeRepos:        5,
			deletingRepos:      2,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 7/5 repositories",
		},
		{
			name:               "deleting repos inflate an over-quota count",
			maxRepos:           5,
			activeRepos:        7,
			deletingRepos:      3,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 10/5 repositories",
		},
		{
			name:               "a namespace with every repo being deleted is still over quota",
			maxRepos:           5,
			activeRepos:        0,
			deletingRepos:      10,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 10/5 repositories",
		},
		{
			name:               "a deletion does not bring the namespace under quota until it finishes",
			maxRepos:           3,
			activeRepos:        3,
			deletingRepos:      2,
			expectedStatus:     metav1.ConditionFalse,
			expectedReason:     provisioning.ReasonQuotaExceeded,
			expectedMessageFmt: "namespace quota exceeded: 5/3 repositories",
		},
		{
			name:               "a deleting repo holds its place until it is gone",
			maxRepos:           3,
			activeRepos:        2,
			deletingRepos:      1,
			expectedStatus:     metav1.ConditionTrue,
			expectedReason:     provisioning.ReasonQuotaReached,
			expectedMessageFmt: "namespace quota reached: 3/3 repositories",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create active repositories (no DeletionTimestamp)
			repos := make([]*provisioning.Repository, 0, tt.activeRepos+tt.deletingRepos)
			for i := range tt.activeRepos {
				repos = append(repos, &provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{
						Name:      fmt.Sprintf("active-repo-%d", i),
						Namespace: namespace,
					},
				})
			}

			// Create deleting repositories (with DeletionTimestamp)
			deletionTime := metav1.Now()
			for i := range tt.deletingRepos {
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

			checker := NewRepositoryQuotaChecker(informer.NewCachedRepositoryGetter(mockRepoLister))

			quotaStatus := provisioning.QuotaStatus{
				MaxRepositories:           tt.maxRepos,
				MaxResourcesPerRepository: 100,
			}

			// Execute
			condition, err := checker.RepositoryQuotaConditions(ctx, namespace, quotaStatus)

			// Assert
			require.NoError(t, err)
			assert.Equal(t, provisioning.ConditionTypeNamespaceQuota, condition.Type)
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

// Under round-robin NATS delivery, a replica can reconcile a repository whose
// live ADDED went to another replica, so its store does not hold it yet. Reading
// the repository must make the quota check count it; otherwise a repository
// blocked over quota elsewhere reads as within quota here and gets unblocked.
func TestRepositoryQuotaConditions_CountsTheRepositoryUnderReconciliation(t *testing.T) {
	ctx := context.Background()
	existing := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "existing", ResourceVersion: "1"}}
	added := &provisioning.Repository{ObjectMeta: metav1.ObjectMeta{Namespace: "ns", Name: "added-elsewhere", ResourceVersion: "2"}}

	// This replica's snapshot has seen only the older repository.
	snapshot := fakeSnapshot{{Namespace: existing.Namespace, Name: existing.Name}}
	getter := informer.NewClientRepositoryGetter(fake.NewClientset(existing, added).ProvisioningV0alpha1(), snapshot)

	_, err := getter.Get(ctx, "ns", added.Name)
	require.NoError(t, err)

	condition, err := NewRepositoryQuotaChecker(getter).RepositoryQuotaConditions(ctx, "ns", provisioning.QuotaStatus{MaxRepositories: 1})
	require.NoError(t, err)
	assert.Equal(t, provisioning.ReasonQuotaExceeded, condition.Reason)
	assert.Equal(t, "namespace quota exceeded: 2/1 repositories", condition.Message)
}

// fakeSnapshot stands in for the informer's snapshot, which holds identities only.
type fakeSnapshot []resource.Identifier

func (s fakeSnapshot) Snapshot() []resource.Identifier { return s }
