package controller

import (
	"context"
	"fmt"
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
		name             string
		cfg              *provisioning.Repository
		others           []*provisioning.Repository
		expectedStatus   metav1.ConditionStatus
		expectedReason   string
		expectedInMsg    []string // every one of these must appear in condition.Message
		notExpectedInMsg []string // none of these may appear in condition.Message
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
			expectedStatus:   metav1.ConditionTrue,
			expectedReason:   provisioning.ReasonNoPathConflict,
			notExpectedInMsg: []string{"other-repo"},
		},
		{
			name: "duplicate path - this is a warning, not a block",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana"),
			others: []*provisioning.Repository{
				gitRepo("existing-repo", "https://github.com/org/repo", "main", "grafana"),
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPathConflict,
			expectedInMsg:  []string{"existing-repo"},
		},
		{
			name: "overlapping parent/child path",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana/dashboards"),
			others: []*provisioning.Repository{
				gitRepo("existing-repo", "https://github.com/org/repo", "main", "grafana"),
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPathConflict,
			expectedInMsg:  []string{"existing-repo"},
		},
		{
			// new-repo (path "grafana/dashboards") conflicts with all three others at once:
			// an exact duplicate and two ancestor/descendant overlaps. The message must name
			// every conflicting repository, not just whichever one a single-match check
			// happens to find first in an unordered list.
			name: "conflicts with multiple repositories at once - all are named",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana/dashboards"),
			others: []*provisioning.Repository{
				gitRepo("zebra-duplicate", "https://github.com/org/repo", "main", "grafana/dashboards"),
				gitRepo("apple-duplicate", "https://github.com/org/repo", "main", "grafana/dashboards"),
				gitRepo("parent-overlap", "https://github.com/org/repo", "main", "grafana"),
				gitRepo("child-overlap", "https://github.com/org/repo", "main", "grafana/dashboards/nested"),
				gitRepo("unrelated", "https://github.com/org/repo", "main", "totally/different"),
			},
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPathConflict,
			expectedInMsg: []string{
				"zebra-duplicate", "apple-duplicate", "parent-overlap", "child-overlap",
			},
			notExpectedInMsg: []string{"unrelated"},
		},
		{
			// 15 duplicates sort as dup-01..dup-15; the message should only name the first 10
			// and say how many were left out, rather than growing unbounded.
			name: "more than 10 conflicts - message is capped with a count of the rest",
			cfg:  gitRepo("new-repo", "https://github.com/org/repo", "main", "grafana"),
			others: func() []*provisioning.Repository {
				repos := make([]*provisioning.Repository, 15)
				for i := range repos {
					repos[i] = gitRepo(fmt.Sprintf("dup-%02d", i+1), "https://github.com/org/repo", "main", "grafana")
				}
				return repos
			}(),
			expectedStatus: metav1.ConditionFalse,
			expectedReason: provisioning.ReasonPathConflict,
			expectedInMsg: []string{
				"dup-01", "dup-02", "dup-03", "dup-04", "dup-05",
				"dup-06", "dup-07", "dup-08", "dup-09", "dup-10",
				"and 5 more",
			},
			notExpectedInMsg: []string{"dup-11", "dup-12", "dup-13", "dup-14", "dup-15"},
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
			for _, name := range tt.expectedInMsg {
				assert.Contains(t, condition.Message, name)
			}
			for _, name := range tt.notExpectedInMsg {
				assert.NotContains(t, condition.Message, name)
			}
		})
	}
}
