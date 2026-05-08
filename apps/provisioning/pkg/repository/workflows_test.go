package repository

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

func TestIsWriteAllowed(t *testing.T) {
	tests := []struct {
		name        string
		repository  *provisioning.Repository
		ref         string
		wantErr     bool
		expectedErr string
		statusCode  int32
	}{
		{
			name: "read only repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{},
				},
			},
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "write workflow allowed",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			ref:     "",
			wantErr: false,
		},
		{
			name: "write allowed for configured branch of github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "feature-branch",
					},
				},
			},
			ref:     "feature-branch",
			wantErr: false,
		},
		{
			name: "write not allowed for configured branch of github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "feature-branch",
					},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "write workflow not allowed for github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "feature-branch",
					},
				},
			},
			ref:         "",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "write workflow not allowed",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				},
			},
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "branch workflow on non-github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.LocalRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: branch workflow is not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "branch workflow allowed on github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
				},
			},
			ref:     "feature-branch",
			wantErr: false,
		},
		{
			name: "branch workflow not allowed on github repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitHubRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: branch workflow is not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "write workflow allowed on git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:     "",
			wantErr: false,
		},
		{
			name: "write allowed for configured branch of git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "develop",
					},
				},
			},
			ref:     "develop",
			wantErr: false,
		},
		{
			name: "write not allowed for configured branch of git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:         "main",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "write workflow not allowed for git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:         "",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "branch workflow allowed on git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:     "feature-branch",
			wantErr: false,
		},
		{
			name: "branch workflow not allowed on git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:         "feature-branch",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: branch workflow is not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "both workflows allowed on git repository - write workflow",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:     "",
			wantErr: false,
		},
		{
			name: "both workflows allowed on git repository - branch workflow",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow, provisioning.BranchWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:     "feature-branch",
			wantErr: false,
		},
		{
			name: "read only git repository",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			ref:         "",
			wantErr:     true,
			expectedErr: "repositories.provisioning.grafana.app is forbidden: write operations are not allowed for this repository",
			statusCode:  http.StatusForbidden,
		},
		{
			name: "git repository with empty branch config - write workflow",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "",
					},
				},
			},
			ref:     "",
			wantErr: false,
		},
		{
			name: "git repository with empty branch config - branch workflow",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.BranchWorkflow},
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "",
					},
				},
			},
			ref:     "custom-branch",
			wantErr: false,
		},
		{
			name: "git repository without git config",
			repository: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      provisioning.GitRepositoryType,
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
					Git:       nil,
				},
			},
			ref:     "",
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := IsWriteAllowed(tt.repository, tt.ref)
			if tt.wantErr {
				require.Error(t, err)
				require.Equal(t, tt.expectedErr, err.Error())

				var (
					statusErr *apierrors.StatusError
					apiStatus apierrors.APIStatus
				)
				switch {
				case errors.As(err, &statusErr):
					require.Equal(t, tt.statusCode, statusErr.Status().Code)
				case errors.As(err, &apiStatus):
					require.Equal(t, tt.statusCode, apiStatus.Status().Code)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestCanUseIncrementalSync(t *testing.T) {
	tests := []struct {
		name                  string
		deletedPaths          []string
		folderMetadataEnabled bool
		totalChanges          int
		maxIncrementalChanges int
		want                  bool
	}{
		// ─── size-threshold boundary cases ─────────────────────────────────────
		{
			name:                  "empty diff stays incremental",
			deletedPaths:          nil,
			totalChanges:          0,
			maxIncrementalChanges: 100,
			want:                  true,
		},
		{
			name:                  "diff one-under threshold stays incremental",
			deletedPaths:          nil,
			totalChanges:          99,
			maxIncrementalChanges: 100,
			want:                  true,
		},
		{
			name:                  "diff at threshold stays incremental (strict greater-than)",
			deletedPaths:          nil,
			totalChanges:          100,
			maxIncrementalChanges: 100,
			want:                  true,
		},
		{
			name:                  "diff above threshold forces full sync",
			deletedPaths:          nil,
			totalChanges:          101,
			maxIncrementalChanges: 100,
			want:                  false,
		},
		{
			name:                  "diff far above threshold forces full sync",
			deletedPaths:          nil,
			totalChanges:          1000,
			maxIncrementalChanges: 100,
			want:                  false,
		},
		{
			name:                  "threshold of 0 disables size check",
			deletedPaths:          nil,
			totalChanges:          1000,
			maxIncrementalChanges: 0,
			want:                  true,
		},
		{
			name:                  "negative threshold disables size check",
			deletedPaths:          nil,
			totalChanges:          1000,
			maxIncrementalChanges: -1,
			want:                  true,
		},
		{
			name:                  "threshold of 0 with empty diff stays incremental",
			deletedPaths:          nil,
			totalChanges:          0,
			maxIncrementalChanges: 0,
			want:                  true,
		},
		{
			name:                  "threshold of 0 with folder-metadata-only-delete still forces full",
			deletedPaths:          []string{"folder1/.keep"},
			totalChanges:          1,
			maxIncrementalChanges: 0,
			want:                  false,
		},
		// ─── folder-metadata-only deletion cases ───────────────────────────────
		{
			name:         "no deleted paths",
			deletedPaths: []string{},
			want:         true,
		},
		{
			name:         "no keep file deletions",
			deletedPaths: []string{"test.json"},
			totalChanges: 1,
			want:         true,
		},
		{
			name:         "keep file deletion at root without other deletions",
			deletedPaths: []string{".keep"},
			totalChanges: 1,
			want:         false,
		},
		{
			name:         "keep file deletion with other deletions in same folder",
			deletedPaths: []string{"test/.keep", "test/test.json"},
			totalChanges: 2,
			want:         true,
		},
		{
			name:         "multiple keep files in different folders without other deletions",
			deletedPaths: []string{"folder1/.keep", "folder2/.keep"},
			totalChanges: 2,
			want:         false,
		},
		{
			name:         "nested folder with only keep file deleted",
			deletedPaths: []string{"parent/child/.keep"},
			totalChanges: 1,
			want:         false,
		},
		{
			name:         "some folders with only keep, some with other files",
			deletedPaths: []string{"folder1/.keep", "folder2/.keep", "folder2/dashboard.json"},
			totalChanges: 3,
			want:         false,
		},
		{
			name:         "only regular files deleted from multiple folders",
			deletedPaths: []string{"folder1/file1.json", "folder2/file2.json", "folder3/file3.json"},
			totalChanges: 3,
			want:         true,
		},
		{
			name:                  "folder metadata file deleted alone - flag on",
			deletedPaths:          []string{"folder1/_folder.json"},
			folderMetadataEnabled: true,
			totalChanges:          1,
			want:                  false,
		},
		{
			name:                  "folder metadata file deleted alone - flag off",
			deletedPaths:          []string{"folder1/_folder.json"},
			folderMetadataEnabled: false,
			totalChanges:          1,
			want:                  true,
		},
		{
			name:                  "folder metadata file deleted with other files in same folder - flag on",
			deletedPaths:          []string{"folder1/_folder.json", "folder1/dashboard.json"},
			folderMetadataEnabled: true,
			totalChanges:          2,
			want:                  true,
		},
		{
			name:                  "folder metadata and keep file deleted together without other files - flag on",
			deletedPaths:          []string{"folder1/.keep", "folder1/_folder.json"},
			folderMetadataEnabled: true,
			totalChanges:          2,
			want:                  false,
		},
		{
			name:                  "folder metadata at root deleted alone - flag on",
			deletedPaths:          []string{"_folder.json"},
			folderMetadataEnabled: true,
			totalChanges:          1,
			want:                  false,
		},
		{
			name:                  "nested folder metadata deleted alone - flag on",
			deletedPaths:          []string{"parent/child/_folder.json"},
			folderMetadataEnabled: true,
			totalChanges:          1,
			want:                  false,
		},
		{
			name:                  "mixed: folder metadata alone in one dir, other files in another - flag on",
			deletedPaths:          []string{"folder1/_folder.json", "folder2/dashboard.json"},
			folderMetadataEnabled: true,
			totalChanges:          2,
			want:                  false,
		},
		// ─── size check is evaluated before the folder-metadata guard ──────────
		{
			name:                  "above threshold overrides folder-metadata guard",
			deletedPaths:          []string{"folder1/.keep"},
			totalChanges:          201,
			maxIncrementalChanges: 100,
			want:                  false,
		},
		{
			name:                  "created-only diff above threshold forces full sync",
			deletedPaths:          nil,
			totalChanges:          150,
			maxIncrementalChanges: 100,
			want:                  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policy := NewIncrementalSyncPolicy(tt.folderMetadataEnabled, tt.maxIncrementalChanges)
			got := policy.CanUseIncrementalSync(tt.deletedPaths, tt.totalChanges)
			require.Equal(t, tt.want, got)
		})
	}
}
