package repository

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/quotas"
)

// verifyTestStorage implements StorageLister for verify tests
type verifyTestStorage struct {
	repositories []provisioning.Repository
}

func (m *verifyTestStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &provisioning.RepositoryList{Items: m.repositories}, nil
}

func TestVerifyAgainstExistingRepositoriesValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		cfg             *provisioning.Repository
		existingRepos   []provisioning.Repository
		wantErr         bool
		wantErrContains string
		maxRepositories int64
	}{
		{
			name: "allows first repository with instance sync",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance},
				},
			},
			existingRepos:   []provisioning.Repository{},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids instance sync when other repos exist",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance},
				},
			},
			existingRepos: []provisioning.Repository{
				{ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"}},
			},
			wantErr:         true,
			wantErrContains: "Instance repository can only be created when no other repositories exist",
			maxRepositories: 10,
		},
		{
			name: "forbids folder sync when instance repo exists",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "instance-repo"},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance},
					},
				},
			},
			wantErr:         true,
			wantErrContains: "Cannot create folder repository when instance repository exists",
			maxRepositories: 10,
		},
		{
			name: "allows folder sync when no instance repo exists",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "folder-repo"},
					Spec: provisioning.RepositorySpec{
						Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids duplicate git path when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "grafana/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         true,
			wantErrContains: ErrRepositoryDuplicatePath.Error(),
			maxRepositories: 10,
		},
		{
			name: "allows duplicate git path when sync is disabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: false},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "grafana/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids duplicate empty paths when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "",
						},
					},
				},
			},
			wantErr:         true,
			wantErrContains: ErrRepositoryDuplicatePath.Error(),
			maxRepositories: 10,
		},
		{
			name: "allows duplicate empty paths when sync is disabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: false},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows empty paths with different URLs when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo2",
						Path: "",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo1",
							Path: "",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids duplicate non-empty paths on same branch when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/repo",
						Branch: "main",
						Path:   "grafana/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/org/repo",
							Branch: "main",
							Path:   "grafana/",
						},
					},
				},
			},
			wantErr:         true,
			wantErrContains: ErrRepositoryDuplicatePath.Error(),
			maxRepositories: 10,
		},
		{
			name: "allows same path on different branches when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/repo",
						Branch: "develop",
						Path:   "grafana/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/org/repo",
							Branch: "main",
							Path:   "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows empty path on different branches when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/repo",
						Branch: "develop",
						Path:   "",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/org/repo",
							Branch: "main",
							Path:   "",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows overlapping paths on different branches",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/repo",
						Branch: "develop",
						Path:   "grafana/dashboards/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/org/repo",
							Branch: "main",
							Path:   "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids overlapping paths on same branch",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/repo",
						Branch: "main",
						Path:   "grafana/dashboards/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/org/repo",
							Branch: "main",
							Path:   "grafana/",
						},
					},
				},
			},
			wantErr:         true,
			wantErrContains: ErrRepositoryParentFolderConflict.Error(),
			maxRepositories: 10,
		},
		{
			name: "allows self-update with identical URL branch and path",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "same-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/org/repo",
						Branch: "main",
						Path:   "grafana/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "same-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:    "https://github.com/org/repo",
							Branch: "main",
							Path:   "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows duplicate local repository paths (not checked by git validator)",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-local", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.LocalRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					Local: &provisioning.LocalRepositoryConfig{
						Path: "/data/grafana",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-local"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.LocalRepositoryType,
						Local: &provisioning.LocalRepositoryConfig{
							Path: "/data/grafana",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids parent folder conflict when sync is enabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "grafana/dashboards/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         true,
			wantErrContains: ErrRepositoryParentFolderConflict.Error(),
			maxRepositories: 10,
		},
		{
			name: "allows parent folder path when sync is disabled",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: false},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "grafana/dashboards/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows empty path when sync is disabled (wizard onboarding flow)",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: false},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows different paths in same repo",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo",
						Path: "other/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows same path in different repos",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					Sync: provisioning.SyncOptions{Enabled: true},
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:  "https://github.com/org/repo2",
						Path: "grafana/",
					},
				},
			},
			existingRepos: []provisioning.Repository{
				{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
						GitHub: &provisioning.GitHubRepositoryConfig{
							URL:  "https://github.com/org/repo1",
							Path: "grafana/",
						},
					},
				},
			},
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "forbids more than 10 repositories",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				repos := make([]provisioning.Repository, 10)
				for i := range 10 {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "repo-" + string(rune('a'+i))},
					}
				}
				return repos
			}(),
			wantErr:         true,
			wantErrContains: "Maximum number of 10 repositories reached",
			maxRepositories: 10,
		},
		{
			name: "allows updating existing repo (doesn't count self)",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "existing-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				repos := make([]provisioning.Repository, 10)
				for i := range 10 {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					}
					if i > 0 {
						repos[i].Name = "repo-" + string(rune('a'+i))
					}
				}
				return repos
			}(),
			wantErr:         false,
			maxRepositories: 10,
		},
		{
			name: "allows updating existing repo even when quota is surpassed",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "existing-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				// 15 repos exist but the limit is 5 — quota was lowered after creation
				repos := make([]provisioning.Repository, 15)
				for i := range 15 {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "repo-" + string(rune('a'+i))},
					}
				}
				// replace one entry with the repo being updated
				repos[7] = provisioning.Repository{
					ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
				}
				return repos
			}(),
			wantErr:         false,
			maxRepositories: 5,
		},
		{
			name: "allows unlimited repositories when maxRepositories is 0",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				repos := make([]provisioning.Repository, 20)
				for i := range 20 {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "repo-" + string(rune('a'+i))},
					}
				}
				return repos
			}(),
			wantErr:         false,
			maxRepositories: 0,
		},
		{
			name: "enforces custom maxRepositories limit",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				repos := make([]provisioning.Repository, 5)
				for i := range 5 {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "repo-" + string(rune('a'+i))},
					}
				}
				return repos
			}(),
			wantErr:         true,
			wantErrContains: "Maximum number of 5 repositories reached",
			maxRepositories: 5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &verifyTestStorage{repositories: tt.existingRepos}
			lister := NewStorageLister(store)
			quotaStatus := provisioning.QuotaStatus{MaxRepositories: tt.maxRepositories}
			quotaGetter := quotas.NewFixedQuotaGetter(quotaStatus)
			validatorRaw := NewVerifyAgainstExistingRepositoriesValidator(lister, quotaGetter)
			errList := validatorRaw.Validate(context.Background(), tt.cfg)

			if tt.wantErr {
				require.NotEmpty(t, errList, "expected validation errors")
				if tt.wantErrContains != "" {
					assert.Contains(t, errList.ToAggregate().Error(), tt.wantErrContains)
				}
				return
			}

			assert.Empty(t, errList)
		})
	}
}
