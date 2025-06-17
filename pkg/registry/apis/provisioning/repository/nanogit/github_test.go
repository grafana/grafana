package nanogit

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	pgh "github.com/grafana/grafana/pkg/registry/apis/provisioning/repository/github"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func TestGithubRepository(t *testing.T) {
	apiRepo := repository.NewMockGithubRepository(t)
	gitRepo := repository.NewMockGitRepository(t)

	// Create a proper config for testing
	expectedConfig := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
			GitHub: &provisioning.GitHubRepositoryConfig{
				URL:    "https://github.com/test/repo",
				Branch: "main",
			},
		},
	}

	// Set up mock expectations for the methods that exist
	gitRepo.EXPECT().Config().Return(expectedConfig)
	apiRepo.EXPECT().Owner().Return("test")
	apiRepo.EXPECT().Repo().Return("repo")
	mockClient := pgh.NewMockClient(t)
	apiRepo.EXPECT().Client().Return(mockClient)

	repo := NewGithubRepository(apiRepo, gitRepo)

	t.Run("delegates config to nanogit repo", func(t *testing.T) {
		result := repo.Config()
		require.Equal(t, expectedConfig, result)
	})

	t.Run("delegates owner to api repo", func(t *testing.T) {
		result := repo.Owner()
		require.Equal(t, "test", result)
	})

	t.Run("delegates repo to api repo", func(t *testing.T) {
		result := repo.Repo()
		require.Equal(t, "repo", result)
	})

	t.Run("delegates client to api repo", func(t *testing.T) {
		result := repo.Client()
		require.Equal(t, mockClient, result)
	})
}

func TestGithubRepositoryDelegation(t *testing.T) {
	ctx := context.Background()

	t.Run("delegates test to api repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		expectedResult := &provisioning.TestResults{
			Code:    200,
			Success: true,
		}

		apiRepo.EXPECT().Test(ctx).Return(expectedResult, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.Test(ctx)

		require.NoError(t, err)
		require.Equal(t, expectedResult, result)
	})

	t.Run("delegates read to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		expectedFileInfo := &repository.FileInfo{
			Path: "test.yaml",
			Data: []byte("test data"),
			Ref:  "main",
			Hash: "abc123",
		}

		gitRepo.EXPECT().Read(ctx, "test.yaml", "main").Return(expectedFileInfo, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.Read(ctx, "test.yaml", "main")

		require.NoError(t, err)
		require.Equal(t, expectedFileInfo, result)
	})

	t.Run("delegates read tree to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		expectedEntries := []repository.FileTreeEntry{
			{Path: "file1.yaml", Size: 100, Hash: "hash1", Blob: true},
			{Path: "dir/", Size: 0, Hash: "hash2", Blob: false},
		}

		gitRepo.EXPECT().ReadTree(ctx, "main").Return(expectedEntries, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.ReadTree(ctx, "main")

		require.NoError(t, err)
		require.Equal(t, expectedEntries, result)
	})

	t.Run("delegates create to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		data := []byte("test content")
		gitRepo.EXPECT().Create(ctx, "new-file.yaml", "main", data, "Create new file").Return(nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		err := repo.Create(ctx, "new-file.yaml", "main", data, "Create new file")

		require.NoError(t, err)
	})

	t.Run("delegates update to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		data := []byte("updated content")
		gitRepo.EXPECT().Update(ctx, "existing-file.yaml", "main", data, "Update file").Return(nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		err := repo.Update(ctx, "existing-file.yaml", "main", data, "Update file")

		require.NoError(t, err)
	})

	t.Run("delegates write to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		data := []byte("file content")
		gitRepo.EXPECT().Write(ctx, "file.yaml", "main", data, "Write file").Return(nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		err := repo.Write(ctx, "file.yaml", "main", data, "Write file")

		require.NoError(t, err)
	})

	t.Run("delegates delete to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		gitRepo.EXPECT().Delete(ctx, "file.yaml", "main", "Delete file").Return(nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		err := repo.Delete(ctx, "file.yaml", "main", "Delete file")

		require.NoError(t, err)
	})

	t.Run("delegates history to api repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		expectedHistory := []provisioning.HistoryItem{
			{
				Ref:     "commit1",
				Message: "First commit",
				Authors: []provisioning.Author{{Name: "Test User"}},
			},
		}

		apiRepo.EXPECT().History(ctx, "file.yaml", "main").Return(expectedHistory, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.History(ctx, "file.yaml", "main")

		require.NoError(t, err)
		require.Equal(t, expectedHistory, result)
	})

	t.Run("delegates latest ref to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		expectedRef := "abc123def456"
		gitRepo.EXPECT().LatestRef(ctx).Return(expectedRef, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.LatestRef(ctx)

		require.NoError(t, err)
		require.Equal(t, expectedRef, result)
	})

	t.Run("delegates compare files to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		expectedChanges := []repository.VersionedFileChange{
			{
				Action: repository.FileActionCreated,
				Path:   "new-file.yaml",
				Ref:    "feature-branch",
			},
		}

		gitRepo.EXPECT().CompareFiles(ctx, "main", "feature-branch").Return(expectedChanges, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.CompareFiles(ctx, "main", "feature-branch")

		require.NoError(t, err)
		require.Equal(t, expectedChanges, result)
	})

	t.Run("delegates resource URLs to api repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)

		fileInfo := &repository.FileInfo{
			Path: "dashboard.json",
			Ref:  "main",
			Hash: "hash123",
		}

		expectedURLs := &provisioning.ResourceURLs{
			SourceURL:         "https://github.com/test/repo/blob/main/dashboard.json",
			RepositoryURL:     "https://github.com/test/repo",
			NewPullRequestURL: "https://github.com/test/repo/compare/main...feature",
		}

		apiRepo.EXPECT().ResourceURLs(ctx, fileInfo).Return(expectedURLs, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.ResourceURLs(ctx, fileInfo)

		require.NoError(t, err)
		require.Equal(t, expectedURLs, result)
	})

	t.Run("delegates clone to nanogit repo", func(t *testing.T) {
		apiRepo := repository.NewMockGithubRepository(t)
		gitRepo := repository.NewMockGitRepository(t)
		mockClonedRepo := repository.NewMockClonedRepository(t)

		opts := repository.CloneOptions{
			CreateIfNotExists: true,
			PushOnWrites:      true,
		}

		gitRepo.EXPECT().Clone(ctx, opts).Return(mockClonedRepo, nil)

		repo := NewGithubRepository(apiRepo, gitRepo)
		result, err := repo.Clone(ctx, opts)

		require.NoError(t, err)
		require.Equal(t, mockClonedRepo, result)
	})
}

func TestGithubRepositoryValidation(t *testing.T) {
	tests := []struct {
		name           string
		config         *provisioning.Repository
		expectedErrors int
	}{
		{
			name: "missing github config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			expectedErrors: 1,
		},
		{
			name: "missing github url",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						Branch: "main",
					},
				},
			},
			expectedErrors: 1,
		},
		{
			name: "invalid github url",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "invalid-url",
						Branch: "main",
					},
				},
			},
			expectedErrors: 1,
		},
		{
			name: "non-github url",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://gitlab.com/test/repo",
						Branch: "main",
					},
				},
			},
			expectedErrors: 1,
		},
		{
			name: "valid github config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
					GitHub: &provisioning.GitHubRepositoryConfig{
						URL:    "https://github.com/test/repo",
						Branch: "main",
					},
				},
			},
			expectedErrors: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apiRepo := repository.NewMockGithubRepository(t)
			gitRepo := repository.NewMockGitRepository(t)

			// Set up mock expectations
			gitRepo.EXPECT().Config().Return(tt.config)
			if tt.expectedErrors == 0 {
				// If no validation errors expected, nanogit validation should be called
				gitRepo.EXPECT().Validate().Return(field.ErrorList{})
			}

			repo := NewGithubRepository(apiRepo, gitRepo)

			result := repo.Validate()
			require.Len(t, result, tt.expectedErrors)
		})
	}
}
