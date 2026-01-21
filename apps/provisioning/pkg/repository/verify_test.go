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
)

// verifyTestStorage implements StorageLister for verify tests
type verifyTestStorage struct {
	repositories []provisioning.Repository
}

func (m *verifyTestStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return &provisioning.RepositoryList{Items: m.repositories}, nil
}

func TestExistingRepositoriesValidator_Validate(t *testing.T) {
	tests := []struct {
		name            string
		cfg             *provisioning.Repository
		existingRepos   []provisioning.Repository
		wantErr         bool
		wantErrContains string
	}{
		{
			name: "allows first repository with instance sync",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeInstance},
				},
			},
			existingRepos: []provisioning.Repository{},
			wantErr:       false,
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
			wantErr: false,
		},
		{
			name: "forbids duplicate git path",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
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
		},
		{
			name: "forbids parent folder conflict",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
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
		},
		{
			name: "allows different paths in same repo",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
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
			wantErr: false,
		},
		{
			name: "allows same path in different repos",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
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
			wantErr: false,
		},
		{
			name: "forbids more than 10 repositories",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "new-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				repos := make([]provisioning.Repository, 10)
				for i := 0; i < 10; i++ {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "repo-" + string(rune('a'+i))},
					}
				}
				return repos
			}(),
			wantErr:         true,
			wantErrContains: "Maximum number of 10 repositories reached",
		},
		{
			name: "allows updating existing repo (doesn't count self)",
			cfg: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{Name: "existing-repo", Namespace: "default"},
				Spec:       provisioning.RepositorySpec{},
			},
			existingRepos: func() []provisioning.Repository {
				repos := make([]provisioning.Repository, 10)
				for i := 0; i < 10; i++ {
					repos[i] = provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{Name: "existing-repo"},
					}
					if i > 0 {
						repos[i].Name = "repo-" + string(rune('a'+i))
					}
				}
				return repos
			}(),
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &verifyTestStorage{repositories: tt.existingRepos}
			lister := NewLister(store)
			validator := NewExistingRepositoriesValidator(lister)
			fieldErr := validator.Validate(context.Background(), tt.cfg)

			if tt.wantErr {
				require.NotNil(t, fieldErr)
				if tt.wantErrContains != "" {
					assert.Contains(t, fieldErr.Detail, tt.wantErrContains)
				}
				return
			}

			assert.Nil(t, fieldErr)
		})
	}
}
