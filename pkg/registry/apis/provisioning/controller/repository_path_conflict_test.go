package controller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/informer"
)

func TestRepositoryPathConflictCondition(t *testing.T) {
	gitRepo := func(name, url, branch, path string) *provisioning.Repository {
		return &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "test-ns"},
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
				GitHub: &provisioning.GitHubRepositoryConfig{
					URL:    url,
					Branch: branch,
					Path:   path,
				},
			},
		}
	}

	tests := []struct {
		name           string
		cfg            *provisioning.Repository
		others         []*provisioning.Repository
		expectedStatus metav1.ConditionStatus
		expectedReason string
	}{
		{
			name:           "no other repositories",
			cfg:            gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana"),
			others:         nil,
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonNoPathConflict,
		},
		{
			name: "unrelated repository",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana"),
			others: []*provisioning.Repository{
				gitRepo("other-repo", "https://github.com/org/other", "main", "grafana"),
			},
			expectedStatus: metav1.ConditionTrue,
			expectedReason: provisioning.ReasonNoPathConflict,
		},
		{
			name: "duplicate path - this is a warning, not a block",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana"),
			others: []*provisioning.Repository{
				gitRepo("existing-repo", "https://github.com/org/repo", "main", "grafana"),
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPathConflict,
		},
		{
			name: "overlapping parent/child path",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana/dashboards"),
			others: []*provisioning.Repository{
				gitRepo("existing-repo", "https://github.com/org/repo", "main", "grafana"),
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPathConflict,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			mockNamespaceLister := &MockRepositoryNamespaceLister{}
			mockNamespaceLister.On("List", mock.Anything).Return(tt.others, nil)
			mockRepoLister := &MockRepositoryLister{namespaceLister: mockNamespaceLister}

			checker := NewRepositoryPathConflictChecker(informer.NewCachedRepositoryGetter(mockRepoLister))

			condition, err := checker.RepositoryPathConflictCondition(ctx, tt.cfg)

			require.NoError(t, err)
			assert.Equal(t, provisioning.ConditionTypePathConflict, condition.Type)
			assert.Equal(t, tt.expectedStatus, condition.Status)
			assert.Equal(t, tt.expectedReason, condition.Reason)
			assert.NotEmpty(t, condition.Message)
		})
	}
}
