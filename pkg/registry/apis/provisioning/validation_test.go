package provisioning

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestVerifyAgainstExistingRepositories_LimitsProvider(t *testing.T) {
	tests := []struct {
		name           string
		existingRepos  []provisioning.Repository
		cfg            *provisioning.Repository
		limitsProvider func() *quotas.MockNamespaceLimitsProvider
		expectedType   field.ErrorType
	}{
		{
			name: "limits provider returns error",
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo1",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 1",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
			},
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo2",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Repository 2",
					Sync: provisioning.SyncOptions{
						Target: provisioning.SyncTargetTypeFolder,
					},
				},
			},
			limitsProvider: func() *quotas.MockNamespaceLimitsProvider {
				m := quotas.NewMockNamespaceLimitsProvider(t)
				m.On("GetMaxRepositories", mock.Anything, "default").Return(0, errors.New("database connection failed"))
				return m
			},
			expectedType: field.ErrorTypeInternal,
		},
		{
			name: "honors limit when count equals max",
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo1",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 1",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo2",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 2",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
			},
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo3",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Repository 3",
					Sync: provisioning.SyncOptions{
						Target: provisioning.SyncTargetTypeFolder,
					},
				},
			},
			limitsProvider: func() *quotas.MockNamespaceLimitsProvider {
				m := quotas.NewMockNamespaceLimitsProvider(t)
				// Limit is 2, and we have 2 existing repos (excluding the one being created)
				m.On("GetMaxRepositories", mock.Anything, "default").Return(2, nil)
				return m
			},
			expectedType: field.ErrorTypeForbidden,
		},
		{
			name: "honors limit when count exceeds max",
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo1",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 1",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo2",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 2",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo3",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 3",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
			},
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo4",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Repository 4",
					Sync: provisioning.SyncOptions{
						Target: provisioning.SyncTargetTypeFolder,
					},
				},
			},
			limitsProvider: func() *quotas.MockNamespaceLimitsProvider {
				m := quotas.NewMockNamespaceLimitsProvider(t)
				// Limit is 2, but we have 3 existing repos (excluding the one being created)
				m.On("GetMaxRepositories", mock.Anything, "default").Return(2, nil)
				return m
			},
			expectedType: field.ErrorTypeForbidden,
		},
		{
			name: "does not hit limit when count is below max",
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{
						Name:      "repo1",
						Namespace: "default",
					},
					Spec: provisioning.RepositorySpec{
						Title: "Repository 1",
						Sync: provisioning.SyncOptions{
							Target: provisioning.SyncTargetTypeFolder,
						},
					},
				},
			},
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "repo2",
					Namespace: "default",
				},
				Spec: provisioning.RepositorySpec{
					Title: "Repository 2",
					Sync: provisioning.SyncOptions{
						Target: provisioning.SyncTargetTypeFolder,
					},
				},
			},
			limitsProvider: func() *quotas.MockNamespaceLimitsProvider {
				m := quotas.NewMockNamespaceLimitsProvider(t)
				// Limit is 5, and we have 1 existing repo (excluding the one being created)
				m.On("GetMaxRepositories", mock.Anything, "default").Return(5, nil)
				return m
			},
			expectedType: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			// Setup mock repository lister
			mockLister := NewMockRepositoryLister(t)
			repoList := &provisioning.RepositoryList{
				Items: tt.existingRepos,
			}
			mockLister.On("List", mock.Anything, mock.Anything).Return(repoList, nil)

			// Setup mock limits provider
			mockLimits := tt.limitsProvider()

			// Call the function under test
			err := VerifyAgainstExistingRepositories(ctx, mockLister, tt.cfg, mockLimits)

			// Verify results
			if tt.expectedType != "" {
				require.NotNil(t, err, "expected an error from limits provider")
				assert.Equal(t, tt.expectedType, err.Type)
			}

			// Verify mocks were called as expected
			mockLister.AssertExpectations(t)
			mockLimits.AssertExpectations(t)
		})
	}
}
