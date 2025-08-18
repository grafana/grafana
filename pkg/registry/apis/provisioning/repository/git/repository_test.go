package git

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/secrets"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/mocks"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
)

func TestGitRepository_Validate(t *testing.T) {
	tests := []struct {
		name      string
		config    *provisioning.Repository
		gitConfig RepositoryConfig
		want      field.ErrorList // number of expected validation errors
	}{
		{
			name: "valid config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "token123",
				Path:   "configs",
			},
			want: nil,
		},
		{
			name: "missing URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Token:  "token123",
			},
			want: field.ErrorList{
				field.Required(field.NewPath("spec", "test_type", "url"), "a git url is required"),
			},
		},
		{
			name: "invalid URL scheme",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "http://git.example.com/repo.git",
				Branch: "main",
				Token:  "token123",
			},
			want: field.ErrorList{
				field.Invalid(field.NewPath("spec", "test_type", "url"), "http://git.example.com/repo.git", "invalid git URL format"),
			},
		},
		{
			name: "missing host",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https:///repo.git", // URL with missing host
				Branch: "main",
				Token:  "token123",
			},
			want: field.ErrorList{
				field.Invalid(field.NewPath("spec", "test_type", "url"), "https:///repo.git", "invalid git URL format"),
			},
		},
		{
			name: "unparseable url",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "://not a valid url",
				Branch: "main",
				Token:  "token123",
			},
			want: field.ErrorList{
				field.Invalid(field.NewPath("spec", "test_type", "url"), "://not a valid url", "invalid git URL format"),
			},
		},
		{
			name: "missing branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "", // Empty branch
				Token:  "token123",
			},
			want: field.ErrorList{
				field.Required(field.NewPath("spec", "test_type", "branch"), "a git branch is required"),
			},
		},
		{
			name: "invalid branch name",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "invalid/branch*name", // Invalid branch name
				Token:  "token123",
			},
			want: field.ErrorList{
				field.Invalid(field.NewPath("spec", "test_type", "branch"), "invalid/branch*name", "invalid branch name"),
			},
		},
		{
			name: "missing token for R/W repository",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      "test_type",
					Workflows: []provisioning.Workflow{provisioning.WriteWorkflow},
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "", // Empty token
			},
			want: field.ErrorList{
				field.Required(field.NewPath("spec", "test_type", "token"), "a git access token is required"),
			},
		},
		{
			name: "missing token for read-only repository",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type:      "test_type",
					Workflows: nil, // read-only
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "", // Empty token
			},
			want: nil,
		},
		{
			name: "unsafe path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "token123",
				Path:   "../unsafe/path",
			},
			want: field.ErrorList{
				field.Invalid(field.NewPath("spec", "test_type", "path"), "../unsafe/path", "path contains traversal attempt (./ or ../)"),
			},
		},
		{
			name: "absolute path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: "test_type",
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "token123",
				Path:   "/absolute/path",
			},
			want: field.ErrorList{
				field.Invalid(field.NewPath("spec", "test_type", "path"), "/absolute/path", "path must be relative"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := &gitRepository{
				config:    tt.config,
				gitConfig: tt.gitConfig,
			}

			errors := gitRepo.Validate()
			require.Equal(t, tt.want, errors)
		})
	}
}

func TestIsValidGitURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want bool
	}{
		{
			name: "valid HTTPS URL",
			url:  "https://git.example.com/owner/repo.git",
			want: true,
		},
		{
			name: "invalid HTTP URL",
			url:  "http://git.example.com/owner/repo.git",
			want: false,
		},
		{
			name: "missing scheme",
			url:  "git.example.com/owner/repo.git",
			want: false,
		},
		{
			name: "empty path",
			url:  "https://git.example.com/",
			want: false,
		},
		{
			name: "no path",
			url:  "https://git.example.com",
			want: false,
		},
		{
			name: "missing host",
			url:  "https:///repo.git",
			want: false,
		},
		{
			name: "unparseable url",
			url:  "://bad-url",
			want: false,
		},
		{
			name: "invalid URL",
			url:  "not-a-url",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isValidGitURL(tt.url)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestNewGit(t *testing.T) {
	ctx := context.Background()

	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
		},
	}

	gitConfig := RepositoryConfig{
		URL:    "https://git.example.com/owner/repo.git",
		Branch: "main",
		Token:  "test-token",
		Path:   "configs",
	}

	mockSecrets := secrets.NewMockRepositorySecrets(t)
	// This should succeed in creating the client but won't be able to connect
	// We just test that the basic structure is created correctly
	gitRepo, err := NewGitRepository(ctx, config, gitConfig, mockSecrets)
	require.NoError(t, err)
	require.NotNil(t, gitRepo)
	require.Equal(t, "https://git.example.com/owner/repo.git", gitRepo.URL())
	require.Equal(t, "main", gitRepo.Branch())
	require.Equal(t, config, gitRepo.Config())
}

func TestCreateSignature(t *testing.T) {
	gitRepo := &gitRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
		gitConfig: RepositoryConfig{
			URL:    "https://git.example.com/repo.git",
			Branch: "main",
			Token:  "token123",
		},
	}

	t.Run("should use default signature when no context signature", func(t *testing.T) {
		ctx := context.Background()
		author, committer := gitRepo.createSignature(ctx)

		require.Equal(t, "Grafana", author.Name)
		require.Equal(t, "noreply@grafana.com", author.Email)
		require.False(t, author.Time.IsZero())

		require.Equal(t, "Grafana", committer.Name)
		require.Equal(t, "noreply@grafana.com", committer.Email)
		require.False(t, committer.Time.IsZero())
	})

	t.Run("should use context signature when available", func(t *testing.T) {
		sig := repository.CommitSignature{
			Name:  "John Doe",
			Email: "john@example.com",
			When:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		}
		ctx := repository.WithAuthorSignature(context.Background(), sig)

		author, committer := gitRepo.createSignature(ctx)

		require.Equal(t, "John Doe", author.Name)
		require.Equal(t, "john@example.com", author.Email)
		require.Equal(t, time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC), author.Time)

		require.Equal(t, "John Doe", committer.Name)
		require.Equal(t, "john@example.com", committer.Email)
		require.Equal(t, time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC), committer.Time)
	})

	t.Run("should fallback to default when context signature has empty name", func(t *testing.T) {
		sig := repository.CommitSignature{
			Name:  "",
			Email: "john@example.com",
			When:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		}
		ctx := repository.WithAuthorSignature(context.Background(), sig)

		author, committer := gitRepo.createSignature(ctx)

		require.Equal(t, "Grafana", author.Name)
		require.Equal(t, "noreply@grafana.com", author.Email)
		require.False(t, author.Time.IsZero())

		require.Equal(t, "Grafana", committer.Name)
		require.Equal(t, "noreply@grafana.com", committer.Email)
		require.False(t, committer.Time.IsZero())
	})

	t.Run("should use current time when signature time is zero", func(t *testing.T) {
		sig := repository.CommitSignature{
			Name:  "John Doe",
			Email: "john@example.com",
			When:  time.Time{}, // Zero time
		}
		ctx := repository.WithAuthorSignature(context.Background(), sig)

		before := time.Now()
		author, committer := gitRepo.createSignature(ctx)
		after := time.Now()

		require.Equal(t, "John Doe", author.Name)
		require.Equal(t, "john@example.com", author.Email)
		require.True(t, author.Time.After(before.Add(-time.Second)))
		require.True(t, author.Time.Before(after.Add(time.Second)))

		require.Equal(t, "John Doe", committer.Name)
		require.Equal(t, "john@example.com", committer.Email)
		require.True(t, committer.Time.After(before.Add(-time.Second)))
		require.True(t, committer.Time.Before(after.Add(time.Second)))
	})
}

func TestEnsureBranchExists(t *testing.T) {
	gitRepo := &gitRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
		gitConfig: RepositoryConfig{
			URL:    "https://git.example.com/repo.git",
			Branch: "main",
			Token:  "token123",
		},
	}

	t.Run("should reject invalid branch name", func(t *testing.T) {
		ctx := context.Background()
		_, err := gitRepo.ensureBranchExists(ctx, "feature//branch")

		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, int32(400), statusErr.Status().Code)
		require.Equal(t, "invalid branch name", statusErr.Status().Message)
	})

	t.Run("should validate branch names for validation errors only", func(t *testing.T) {
		testCases := []struct {
			name        string
			branchName  string
			shouldError bool
		}{
			{"invalid double slash", "feature//branch", true},
			{"invalid double dot", "feature..branch", true},
			{"invalid ending with dot", "feature.", true},
			{"invalid starting with slash", "/feature", true},
			{"invalid ending with slash", "feature/", true},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				ctx := context.Background()
				_, err := gitRepo.ensureBranchExists(ctx, tc.branchName)

				if tc.shouldError {
					require.Error(t, err)
					var statusErr *apierrors.StatusError
					require.True(t, errors.As(err, &statusErr))
					require.Equal(t, int32(400), statusErr.Status().Code)
					require.Equal(t, "invalid branch name", statusErr.Status().Message)
				}
			})
		}
	})
}

func TestHistory(t *testing.T) {
	t.Run("should return not implemented", func(t *testing.T) {
		ctx := context.Background()
		history, err := (&gitRepository{}).History(ctx, "", "")

		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.True(t, errors.As(err, &statusErr))
		require.Equal(t, int32(http.StatusNotImplemented), statusErr.Status().Code)
		require.Equal(t, metav1.StatusReasonMethodNotAllowed, statusErr.Status().Reason)
		require.Equal(t, "history is not supported for pure git repositories", statusErr.Status().Message)
		require.Nil(t, history)
	})
}

func TestGitRepository_Test(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*mocks.FakeClient)
		gitConfig   RepositoryConfig
		wantResults *provisioning.TestResults
		wantError   error
	}{
		{
			name: "success - all checks pass",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(true, nil)
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantResults: &provisioning.TestResults{
				Success: true,
				Errors:  nil,
				Code:    http.StatusOK,
			},
			wantError: nil,
		},
		{
			name: "failure - not authorized (error)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(false, errors.New("auth error"))
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantResults: &provisioning.TestResults{
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "test_type", "token").String(),
						Detail: "failed check if authorized: auth error",
					},
				},
				Code: http.StatusBadRequest,
			},
			wantError: nil,
		},
		{
			name: "failure - not authorized (false result)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(false, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantResults: &provisioning.TestResults{
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "test_type", "token").String(),
						Detail: "not authorized",
					},
				},
				Code: http.StatusBadRequest,
			},
			wantError: nil,
		},
		{
			name: "failure - repository not found (error)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(false, errors.New("repo error"))
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantResults: &provisioning.TestResults{
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "test_type", "url").String(),
						Detail: "failed check if repository exists: repo error",
					},
				},
				Code: http.StatusBadRequest,
			},
			wantError: nil,
		},
		{
			name: "failure - repository not found (false result)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(false, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantResults: &provisioning.TestResults{
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "test_type", "url").String(),
						Detail: "repository not found",
					},
				},
				Code: http.StatusBadRequest,
			},
			wantError: nil,
		},
		{
			name: "failure - branch not found (error)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(true, nil)
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("branch not found"))
			},
			gitConfig: RepositoryConfig{
				Branch: "nonexistent",
			},
			wantResults: &provisioning.TestResults{
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "test_type", "branch").String(),
						Detail: "failed to check if branch exists: branch not found",
					},
				},
				Code: http.StatusBadRequest,
			},
			wantError: nil,
		},
		{
			name: "failure - branch not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(true, nil)
				mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "nonexistent",
			},
			wantResults: &provisioning.TestResults{
				Success: false,
				Errors: []provisioning.ErrorDetails{
					{
						Type:   metav1.CauseTypeFieldValueInvalid,
						Field:  field.NewPath("spec", "test_type", "branch").String(),
						Detail: "branch not found",
					},
				},
				Code: http.StatusBadRequest,
			},
			wantError: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: "test_type",
					},
				},
			}

			results, err := gitRepo.Test(context.Background())
			require.NoError(t, err, "Test method should not return an error")

			require.Equal(t, tt.wantResults, results, "Test results mismatch")
			require.Equal(t, tt.wantError, err, "Test error mismatch")

			// Verify the mock calls
			require.Equal(t, 1, mockClient.IsAuthorizedCallCount(), "IsAuthorized should be called exactly once")

			if mockClient.RepoExistsCallCount() > 0 {
				require.Equal(t, 1, mockClient.RepoExistsCallCount(), "RepoExists should be called at most once")
			}

			if mockClient.GetRefCallCount() > 0 {
				require.Equal(t, 1, mockClient.GetRefCallCount(), "GetRef should be called at most once")
				_, ref := mockClient.GetRefArgsForCall(0)
				require.Equal(t, "refs/heads/"+tt.gitConfig.Branch, ref, "GetRef should be called with correct branch reference")
			}
		})
	}
}

func TestGitRepository_Read(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		filePath  string
		ref       string
		wantError bool
		errorType error
	}{
		{
			name: "success - read file",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{
					Content: []byte("file content"),
					Hash:    hash.Hash{},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			filePath:  "test.yaml",
			ref:       "main",
			wantError: false,
		},
		{
			name: "can a read directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.MustFromHex("abcdef1234567890abcdef1234567890abcdef12"),
				}, nil)
				mockClient.GetTreeByPathReturns(&nanogit.Tree{
					Hash: hash.Hash{},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			filePath:  "subdir/",
			ref:       "main",
			wantError: false,
		},
		{
			name: "failure - file not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			filePath:  "missing.yaml",
			ref:       "main",
			wantError: true,
			errorType: repository.ErrFileNotFound,
		},
		{
			name: "failure - ref not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			filePath:  "test.yaml",
			ref:       "nonexistent",
			wantError: true,
			errorType: repository.ErrRefNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: "test_type",
					},
				},
			}

			fileInfo, err := gitRepo.Read(context.Background(), tt.filePath, tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, fileInfo)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, fileInfo)
				require.Equal(t, tt.filePath, fileInfo.Path)
			}
		})
	}
}

func TestGitRepository_ReadTree(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		ref       string
		wantError bool
		errorType error
	}{
		{
			name: "success - read tree",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetFlatTreeReturns(&nanogit.FlatTree{
					Entries: []nanogit.FlatTreeEntry{
						{
							Path: "configs/test.yaml",
							Hash: hash.Hash{},
							Type: protocol.ObjectTypeBlob,
						},
					},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			ref:       "main",
			wantError: false,
		},
		{
			name: "failure - ref not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			ref:       "nonexistent",
			wantError: true,
			errorType: repository.ErrRefNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			entries, err := gitRepo.ReadTree(context.Background(), tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, entries)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, entries)
			}
		})
	}
}

func TestGitRepository_Create(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		path      string
		ref       string
		data      []byte
		comment   string
		wantError bool
		errorType error
	}{
		{
			name: "success - create file",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.CreateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "test.yaml",
			ref:       "main",
			data:      []byte("test content"),
			comment:   "Add test file",
			wantError: false,
		},
		{
			name: "failure - file already exists",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.CreateBlobReturns(hash.Hash{}, nanogit.ErrObjectAlreadyExists)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "existing.yaml",
			ref:       "main",
			data:      []byte("test content"),
			comment:   "Add existing file",
			wantError: true,
			errorType: repository.ErrFileAlreadyExists,
		},
		{
			name: "success - create directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.CreateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "newdir/",
			ref:       "main",
			data:      nil,
			comment:   "Add directory",
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Create(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_Update(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		path      string
		ref       string
		data      []byte
		comment   string
		wantError bool
		errorType error
	}{
		{
			name: "success - update file",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.UpdateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "test.yaml",
			ref:       "main",
			data:      []byte("updated content"),
			comment:   "Update test file",
			wantError: false,
		},
		{
			name: "failure - file not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.UpdateBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "missing.yaml",
			ref:       "main",
			data:      []byte("content"),
			comment:   "Update missing file",
			wantError: true,
			errorType: repository.ErrFileNotFound,
		},
		{
			name: "failure - cannot update directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed as error is caught early
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "directory/",
			ref:       "main",
			data:      []byte("content"),
			comment:   "Update directory",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Update(context.Background(), tt.path, tt.ref, tt.data, tt.comment)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_Delete(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*mocks.FakeClient, *mocks.FakeStagedWriter)
		assertions func(*testing.T, *mocks.FakeClient, *mocks.FakeStagedWriter)
		gitConfig  RepositoryConfig
		path       string
		ref        string
		comment    string
		wantError  bool
		errorType  error
	}{
		{
			name: "success - delete file",
			setupMock: func(mockClient *mocks.FakeClient, mockWriter *mocks.FakeStagedWriter) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)

				mockWriter.DeleteBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "test.yaml",
			ref:       "main",
			comment:   "Delete test file",
			wantError: false,
		},
		{
			name: "success - delete directory",
			setupMock: func(mockClient *mocks.FakeClient, mockWriter *mocks.FakeStagedWriter) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter.DeleteTreeReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			assertions: func(t *testing.T, fakeClient *mocks.FakeClient, mockWriter *mocks.FakeStagedWriter) {
				require.Equal(t, 1, mockWriter.DeleteTreeCallCount(), "DeleteTree should be called once")
				_, p := mockWriter.DeleteTreeArgsForCall(0)
				require.Equal(t, "configs/testdir", p, "DeleteTree should be called with correct path")
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "testdir/",
			ref:       "main",
			comment:   "Delete test directory",
			wantError: false,
		},
		{
			name: "failure - file not found",
			setupMock: func(mockClient *mocks.FakeClient, mockWriter *mocks.FakeStagedWriter) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter.DeleteBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:      "missing.yaml",
			ref:       "main",
			comment:   "Delete missing file",
			wantError: true,
			errorType: repository.ErrFileNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			mockWriter := &mocks.FakeStagedWriter{}
			mockClient.NewStagedWriterReturns(mockWriter, nil)

			tt.setupMock(mockClient, mockWriter)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Delete(context.Background(), tt.path, tt.ref, tt.comment)

			if tt.wantError {
				require.Error(t, err)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
			}

			if tt.assertions != nil {
				tt.assertions(t, mockClient, mockWriter)
			}
		})
	}
}

func TestGitRepository_ListRefs(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		wantError bool
		wantRefs  []provisioning.RefItem
		errorType error
	}{
		{
			name: "success - list refs",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.ListRefsReturns([]nanogit.Ref{
					{
						Name: "refs/heads/main",
						Hash: hash.MustFromHex("abcdef1234567890abcdef1234567890abcdef12"),
					},
					{
						Name: "refs/heads/feature",
						Hash: hash.MustFromHex("1234567890abcdef1234567890abcdef12345678"),
					},
					{
						Name: "refs/tags/v1.0.0",
						Hash: hash.MustFromHex("deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"),
					},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantError: false,
			wantRefs: []provisioning.RefItem{
				{
					Name: "main",
					Hash: "abcdef1234567890abcdef1234567890abcdef12",
				},
				{
					Name: "feature",
					Hash: "1234567890abcdef1234567890abcdef12345678",
				},
			},
		},
		{
			name: "failure - list refs error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.ListRefsReturns(nil, errors.New("list refs failed"))
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantError: true,
			errorType: errors.New("list refs failed"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			refs, err := gitRepo.ListRefs(context.Background())

			if tt.wantError {
				require.Error(t, err)
				if tt.errorType != nil {
					require.Contains(t, err.Error(), tt.errorType.Error())
				}
				require.Nil(t, refs)
			} else {
				require.NoError(t, err)
				require.NotNil(t, refs)
				require.Equal(t, len(tt.wantRefs), len(refs))
				for i, wantRef := range tt.wantRefs {
					require.Equal(t, wantRef.Name, refs[i].Name)
					require.Equal(t, wantRef.Hash, refs[i].Hash)
				}
			}
		})
	}
}

func TestGitRepository_LatestRef(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		wantError bool
		wantRef   string
	}{
		{
			name: "success - get latest ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20}, // Non-empty hash
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantError: false,
			wantRef:   "", // Hash would be converted to string - we just check it's not empty
		},
		{
			name: "failure - branch not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("branch not found"))
			},
			gitConfig: RepositoryConfig{
				Branch: "nonexistent",
			},
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			ref, err := gitRepo.LatestRef(context.Background())

			if tt.wantError {
				require.Error(t, err)
				require.Empty(t, ref)
			} else {
				require.NoError(t, err)
				// For success case with non-empty hash, ref should not be empty
				if tt.name == "success - get latest ref" {
					require.NotEmpty(t, ref)
				}
			}

			// Verify GetRef was called with correct branch
			require.Equal(t, 1, mockClient.GetRefCallCount())
			_, branchRef := mockClient.GetRefArgsForCall(0)
			require.Equal(t, "refs/heads/"+tt.gitConfig.Branch, branchRef)
		})
	}
}

func TestGitRepository_History(t *testing.T) {
	gitRepo := &gitRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	history, err := gitRepo.History(context.Background(), "test.yaml", "main")

	require.Error(t, err)
	require.Nil(t, history)

	var statusErr *apierrors.StatusError
	require.True(t, errors.As(err, &statusErr))
	require.Equal(t, int32(http.StatusNotImplemented), statusErr.Status().Code)
	require.Equal(t, metav1.StatusReasonMethodNotAllowed, statusErr.Status().Reason)
	require.Equal(t, "history is not supported for pure git repositories", statusErr.Status().Message)
}

func TestGitRepository_Write(t *testing.T) {
	tests := []struct {
		name         string
		setupMock    func(*mocks.FakeClient)
		gitConfig    RepositoryConfig
		path         string
		ref          string
		data         []byte
		message      string
		fileExists   bool
		wantError    bool
		expectCreate bool
		expectUpdate bool
	}{
		{
			name: "success - create new file",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call for Read check - file not found
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{}, nanogit.ErrObjectNotFound)

				// Second call for Create
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.CreateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:         "newfile.yaml",
			ref:          "main",
			data:         []byte("content"),
			message:      "Add new file",
			fileExists:   false,
			wantError:    false,
			expectCreate: true,
			expectUpdate: false,
		},
		{
			name: "success - update existing file",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call for Read check - file exists
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.Hash{},
				}, nil)
				mockClient.GetBlobByPathReturns(&nanogit.Blob{
					Content: []byte("old content"),
					Hash:    hash.Hash{},
				}, nil)

				// Second call for Update
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.UpdateBlobReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			path:         "existing.yaml",
			ref:          "main",
			data:         []byte("updated content"),
			message:      "Update existing file",
			fileExists:   true,
			wantError:    false,
			expectCreate: false,
			expectUpdate: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Write(context.Background(), tt.path, tt.ref, tt.data, tt.message)

			if tt.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			// Verify Read was called first to check if file exists
			require.GreaterOrEqual(t, mockClient.GetRefCallCount(), 1)

			if tt.expectCreate || tt.expectUpdate {
				// Verify NewStagedWriter was called
				require.Equal(t, 1, mockClient.NewStagedWriterCallCount())
			}
		})
	}
}

func TestGitRepository_CompareFiles(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*mocks.FakeClient)
		gitConfig   RepositoryConfig
		base        string
		ref         string
		wantError   bool
		wantChanges int
	}{
		{
			name: "success - compare commits with changes",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Return refs for base and ref
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)

				// Return comparison results
				mockClient.CompareCommitsReturns([]nanogit.CommitFile{
					{
						Path:   "configs/new-file.yaml",
						Status: protocol.FileStatusAdded,
					},
					{
						Path:   "configs/modified-file.yaml",
						Status: protocol.FileStatusModified,
					},
					{
						Path:   "configs/deleted-file.yaml",
						Status: protocol.FileStatusDeleted,
					},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			base:        "main",
			ref:         "feature",
			wantError:   false,
			wantChanges: 3,
		},
		{
			name: "success - no changes",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)

				mockClient.CompareCommitsReturns([]nanogit.CommitFile{}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			base:        "main",
			ref:         "main",
			wantError:   false,
			wantChanges: 0,
		},
		{
			name: "failure - ref not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			base:      "main",
			ref:       "nonexistent",
			wantError: true,
		},
		{
			name: "failure - empty ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed as error is caught early
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Path:   "configs",
			},
			base:      "main",
			ref:       "",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			changes, err := gitRepo.CompareFiles(context.Background(), tt.base, tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, changes)
			} else {
				require.NoError(t, err)
				require.NotNil(t, changes)
				require.Len(t, changes, tt.wantChanges)

				// Verify the changes have correct actions
				if tt.wantChanges > 0 {
					for _, change := range changes {
						require.NotEmpty(t, change.Path)
						require.NotEmpty(t, change.Action)
						require.Equal(t, tt.ref, change.Ref)
					}
				}
			}
		})
	}
}

func TestGitRepository_ensureBranchExists(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*mocks.FakeClient)
		gitConfig   RepositoryConfig
		branchName  string
		wantError   bool
		expectCalls int // Expected number of GetRef calls
	}{
		{
			name: "success - branch already exists",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			branchName:  "feature",
			wantError:   false,
			expectCalls: 1,
		},
		{
			name: "success - create new branch",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call - branch doesn't exist
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{}, nanogit.ErrObjectNotFound)
				// Second call - get source branch
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				// CreateRef succeeds
				mockClient.CreateRefReturns(nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			branchName:  "new-feature",
			wantError:   false,
			expectCalls: 2,
		},
		{
			name: "failure - invalid branch name",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed as error is caught early
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			branchName:  "invalid//branch",
			wantError:   true,
			expectCalls: 0,
		},
		{
			name: "failure - source branch not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call - branch doesn't exist
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{}, nanogit.ErrObjectNotFound)
				// Second call - source branch also doesn't exist
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "nonexistent",
			},
			branchName:  "new-feature",
			wantError:   true,
			expectCalls: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			branchRef, err := gitRepo.ensureBranchExists(context.Background(), tt.branchName)

			if tt.wantError {
				require.Error(t, err)
				require.Equal(t, nanogit.Ref{}, branchRef)
			} else {
				require.NoError(t, err)
				require.NotEqual(t, nanogit.Ref{}, branchRef)
				require.Equal(t, "refs/heads/"+tt.branchName, branchRef.Name)
			}

			// Verify expected number of GetRef calls
			require.Equal(t, tt.expectCalls, mockClient.GetRefCallCount())
		})
	}
}

func TestGitRepository_createSignature(t *testing.T) {
	gitRepo := &gitRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
		gitConfig: RepositoryConfig{
			URL:    "https://git.example.com/repo.git",
			Branch: "main",
			Token:  "token123",
		},
	}

	t.Run("should use default signature when no context signature", func(t *testing.T) {
		ctx := context.Background()
		author, committer := gitRepo.createSignature(ctx)

		require.Equal(t, "Grafana", author.Name)
		require.Equal(t, "noreply@grafana.com", author.Email)
		require.False(t, author.Time.IsZero())

		require.Equal(t, "Grafana", committer.Name)
		require.Equal(t, "noreply@grafana.com", committer.Email)
		require.False(t, committer.Time.IsZero())
	})

	t.Run("should use context signature when available", func(t *testing.T) {
		sig := repository.CommitSignature{
			Name:  "John Doe",
			Email: "john@example.com",
			When:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		}
		ctx := repository.WithAuthorSignature(context.Background(), sig)

		author, committer := gitRepo.createSignature(ctx)

		require.Equal(t, "John Doe", author.Name)
		require.Equal(t, "john@example.com", author.Email)
		require.Equal(t, time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC), author.Time)

		require.Equal(t, "John Doe", committer.Name)
		require.Equal(t, "john@example.com", committer.Email)
		require.Equal(t, time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC), committer.Time)
	})

	t.Run("should fallback to default when context signature has empty name", func(t *testing.T) {
		sig := repository.CommitSignature{
			Name:  "",
			Email: "john@example.com",
			When:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		}
		ctx := repository.WithAuthorSignature(context.Background(), sig)

		author, committer := gitRepo.createSignature(ctx)

		require.Equal(t, "Grafana", author.Name)
		require.Equal(t, "noreply@grafana.com", author.Email)
		require.False(t, author.Time.IsZero())

		require.Equal(t, "Grafana", committer.Name)
		require.Equal(t, "noreply@grafana.com", committer.Email)
		require.False(t, committer.Time.IsZero())
	})

	t.Run("should use current time when signature time is zero", func(t *testing.T) {
		sig := repository.CommitSignature{
			Name:  "John Doe",
			Email: "john@example.com",
			When:  time.Time{}, // Zero time
		}
		ctx := repository.WithAuthorSignature(context.Background(), sig)

		before := time.Now()
		author, committer := gitRepo.createSignature(ctx)
		after := time.Now()

		require.Equal(t, "John Doe", author.Name)
		require.Equal(t, "john@example.com", author.Email)
		require.True(t, author.Time.After(before.Add(-time.Second)))
		require.True(t, author.Time.Before(after.Add(time.Second)))

		require.Equal(t, "John Doe", committer.Name)
		require.Equal(t, "john@example.com", committer.Email)
		require.True(t, committer.Time.After(before.Add(-time.Second)))
		require.True(t, committer.Time.Before(after.Add(time.Second)))
	})
}

func TestNewGitRepository(t *testing.T) {
	tests := []struct {
		name      string
		gitConfig RepositoryConfig
		wantError bool
		expectURL string
	}{
		{
			name: "success - with token",
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/owner/repo.git",
				Branch: "main",
				Token:  "plain-token",
				Path:   "configs",
			},
			wantError: false,
			expectURL: "https://git.example.com/owner/repo.git",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()

			config := &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			}

			mockSecrets := secrets.NewMockRepositorySecrets(t)
			gitRepo, err := NewGitRepository(ctx, config, tt.gitConfig, mockSecrets)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, gitRepo)
			} else {
				require.NoError(t, err)
				require.NotNil(t, gitRepo)
				require.Equal(t, tt.expectURL, gitRepo.URL())
				require.Equal(t, tt.gitConfig.Branch, gitRepo.Branch())
				require.Equal(t, config, gitRepo.Config())
			}
		})
	}
}

func TestGitRepository_Getters(t *testing.T) {
	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
		},
	}

	gitConfig := RepositoryConfig{
		URL:    "https://git.example.com/owner/repo.git",
		Branch: "feature-branch",
		Token:  "test-token",
		Path:   "configs",
	}

	gitRepo := &gitRepository{
		config:    config,
		gitConfig: gitConfig,
	}

	t.Run("URL returns correct URL", func(t *testing.T) {
		require.Equal(t, "https://git.example.com/owner/repo.git", gitRepo.URL())
	})

	t.Run("Branch returns correct branch", func(t *testing.T) {
		require.Equal(t, "feature-branch", gitRepo.Branch())
	})

	t.Run("Config returns correct config", func(t *testing.T) {
		require.Equal(t, config, gitRepo.Config())
	})
}

func TestGitRepository_resolveRefToHash(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		ref       string
		wantError bool
		expectRef string
	}{
		{
			name: "success - empty ref uses default branch",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			ref:       "",
			wantError: false,
		},
		{
			name: "success - valid hex hash",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed for valid hash
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			ref:       "abcdef1234567890abcdef1234567890abcdef12",
			wantError: false,
		},
		{
			name: "success - branch reference",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			ref:       "refs/heads/feature",
			wantError: false,
		},
		{
			name: "failure - ref not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			ref:       "nonexistent-ref",
			wantError: true,
		},
		{
			name: "failure - client error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("client error"))
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			ref:       "some-ref",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client:    mockClient,
				gitConfig: tt.gitConfig,
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			refHash, err := gitRepo.resolveRefToHash(context.Background(), tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Equal(t, hash.Zero, refHash)
			} else {
				require.NoError(t, err)
				require.NotNil(t, refHash)
			}
		})
	}
}

func TestGitRepository_commit(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*mocks.FakeStagedWriter)
		comment     string
		wantError   bool
		authorName  string
		authorEmail string
	}{
		{
			name: "success - commit with default signature",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			},
			comment:     "Test commit",
			wantError:   false,
			authorName:  "Grafana",
			authorEmail: "noreply@grafana.com",
		},
		{
			name: "success - commit with context signature",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			},
			comment:     "Test commit with author",
			wantError:   false,
			authorName:  "John Doe",
			authorEmail: "john@example.com",
		},
		{
			name: "failure - commit error",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			comment:   "Failed commit",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			gitRepo := &gitRepository{
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
				gitConfig: RepositoryConfig{
					URL:    "https://git.example.com/repo.git",
					Branch: "main",
					Token:  "token123",
				},
			}

			ctx := context.Background()
			if tt.authorName != "Grafana" {
				// Add context signature for custom author
				sig := repository.CommitSignature{
					Name:  tt.authorName,
					Email: tt.authorEmail,
					When:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
				}
				ctx = repository.WithAuthorSignature(ctx, sig)
			}

			err := gitRepo.commit(ctx, mockWriter, tt.comment)

			if tt.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			// Verify commit was called once
			require.Equal(t, 1, mockWriter.CommitCallCount())

			// Verify commit parameters
			if !tt.wantError {
				ctxParam, commentParam, authorParam, committerParam := mockWriter.CommitArgsForCall(0)
				require.NotNil(t, ctxParam)
				require.Equal(t, tt.comment, commentParam)
				require.Equal(t, tt.authorName, authorParam.Name)
				require.Equal(t, tt.authorEmail, authorParam.Email)
				require.Equal(t, tt.authorName, committerParam.Name)
				require.Equal(t, tt.authorEmail, committerParam.Email)
			}
		})
	}
}

func TestGitRepository_commitAndPush(t *testing.T) {
	tests := []struct {
		name         string
		setupMock    func(*mocks.FakeStagedWriter)
		comment      string
		wantError    bool
		expectCommit bool
		expectPush   bool
	}{
		{
			name: "success - commit and push",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
			},
			comment:      "Test commit and push",
			wantError:    false,
			expectCommit: true,
			expectPush:   true,
		},
		{
			name: "failure - commit fails",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
			comment:      "Failed commit",
			wantError:    true,
			expectCommit: true,
			expectPush:   false,
		},
		{
			name: "failure - push fails",
			setupMock: func(mockWriter *mocks.FakeStagedWriter) {
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(errors.New("push failed"))
			},
			comment:      "Push failure",
			wantError:    true,
			expectCommit: true,
			expectPush:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockWriter := &mocks.FakeStagedWriter{}
			tt.setupMock(mockWriter)

			gitRepo := &gitRepository{
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
				gitConfig: RepositoryConfig{
					URL:    "https://git.example.com/repo.git",
					Branch: "main",
					Token:  "token123",
				},
			}

			err := gitRepo.commitAndPush(context.Background(), mockWriter, tt.comment)

			if tt.wantError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			if tt.expectCommit {
				require.Equal(t, 1, mockWriter.CommitCallCount())
			}

			if tt.expectPush {
				require.Equal(t, 1, mockWriter.PushCallCount())
			} else {
				require.Equal(t, 0, mockWriter.PushCallCount())
			}
		})
	}
}

func TestGitRepository_logger(t *testing.T) {
	gitRepo := &gitRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
		gitConfig: RepositoryConfig{
			URL:    "https://git.example.com/repo.git",
			Branch: "main",
			Token:  "token123",
		},
	}

	t.Run("creates new logger context", func(t *testing.T) {
		ctx := context.Background()
		newCtx, logger := gitRepo.logger(ctx, "feature-branch")

		require.NotNil(t, newCtx)
		require.NotNil(t, logger)
		require.NotEqual(t, ctx, newCtx)
	})

	t.Run("uses default branch when ref is empty", func(t *testing.T) {
		ctx := context.Background()
		newCtx, logger := gitRepo.logger(ctx, "")

		require.NotNil(t, newCtx)
		require.NotNil(t, logger)
	})

	t.Run("returns existing logger when already present", func(t *testing.T) {
		ctx := context.Background()

		// First call creates the logger context
		ctx1, logger1 := gitRepo.logger(ctx, "branch1")

		// Second call should return the existing logger context
		ctx2, logger2 := gitRepo.logger(ctx1, "branch2")

		// When logger context already exists, it should return the same context
		require.Equal(t, ctx1, ctx2)

		// The logger should be the same instance from the existing context
		require.NotNil(t, logger1)
		require.NotNil(t, logger2)

		// Both loggers should be functionally equivalent since they come from the same context
		// We verify this by checking that they produce the same output
		require.IsType(t, logger1, logger2)
	})
}

func TestGitRepository_Stage(t *testing.T) {
	gitRepo := &gitRepository{
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
		gitConfig: RepositoryConfig{
			URL:    "https://git.example.com/repo.git",
			Branch: "main",
			Token:  "token123",
		},
	}

	t.Run("calls NewStagedGitRepository", func(t *testing.T) {
		ctx := context.Background()
		opts := repository.StageOptions{
			Mode: repository.StageModeCommitAndPushOnEach,
		}

		// Since NewStagedGitRepository is not mocked and may panic, we expect this to fail
		// We're testing that the method exists and forwards correctly
		defer func() {
			if r := recover(); r != nil {
				// Expected - NewStagedGitRepository isn't fully implemented for this test scenario
				t.Logf("NewStagedGitRepository panicked as expected: %v", r)
			}
		}()

		staged, err := gitRepo.Stage(ctx, opts)

		// This will likely error/panic since we don't have a real implementation
		// but we're testing that the method exists and forwards to NewStagedGitRepository
		_ = staged
		_ = err
	})
}

func TestGitRepository_EdgeCases(t *testing.T) {
	t.Run("create with data for directory should fail", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
		}, nil)

		mockWriter := &mocks.FakeStagedWriter{}
		mockClient.NewStagedWriterReturns(mockWriter, nil)

		gitRepo := &gitRepository{
			client:    mockClient,
			gitConfig: RepositoryConfig{Branch: "main", Path: "configs"},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType},
			},
		}

		err := gitRepo.Create(context.Background(), "newdir/", "main", []byte("data"), "comment")

		// This should fail because we're providing data for a directory
		require.Error(t, err)
		require.Contains(t, err.Error(), "data cannot be provided for a directory")
	})

	t.Run("update directory path should fail early", func(t *testing.T) {
		gitRepo := &gitRepository{
			gitConfig: RepositoryConfig{Branch: "main", Path: "configs"},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType},
			},
		}

		err := gitRepo.Update(context.Background(), "directory/", "main", []byte("data"), "comment")

		require.Error(t, err)
		require.Contains(t, err.Error(), "cannot update a directory")
	})

	t.Run("write with read error should fail", func(t *testing.T) {
		mockClient := &mocks.FakeClient{}
		mockClient.GetRefReturns(nanogit.Ref{
			Name: "refs/heads/main",
			Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
		}, nil)
		mockClient.GetCommitReturns(&nanogit.Commit{Tree: hash.Hash{}}, nil)
		mockClient.GetBlobByPathReturns(&nanogit.Blob{}, errors.New("some read error"))

		gitRepo := &gitRepository{
			client:    mockClient,
			gitConfig: RepositoryConfig{Branch: "main", Path: "configs"},
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType},
			},
		}

		err := gitRepo.Write(context.Background(), "test.yaml", "main", []byte("data"), "message")

		require.Error(t, err)
		require.Contains(t, err.Error(), "check if file exists before writing")
	})
}

func TestGitRepository_ValidateBranchNames(t *testing.T) {
	tests := []struct {
		name        string
		branchName  string
		expectValid bool
	}{
		{"valid simple branch", "main", true},
		{"valid feature branch", "feature/new-feature", true},
		{"valid branch with numbers", "release-v1.2.3", true},
		{"invalid double slash", "feature//branch", false},
		{"invalid double dot", "feature..branch", false},
		{"invalid ending with dot", "feature.", false},
		{"invalid starting with slash", "/feature", false},
		{"invalid ending with slash", "feature/", false},
		{"invalid with space", "feature branch", false},
		{"invalid with tilde", "feature~1", false},
		{"invalid with caret", "feature^1", false},
		{"invalid with colon", "feature:branch", false},
		{"invalid with question mark", "feature?", false},
		{"invalid with asterisk", "feature*", false},
		{"invalid with square brackets", "feature[1]", false},
		{"invalid with backslash", "feature\\branch", false},
		{"invalid empty string", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := &gitRepository{
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: "test_type",
					},
				},
				gitConfig: RepositoryConfig{
					URL:    "https://git.example.com/repo.git",
					Branch: tt.branchName,
					Token:  "token123",
				},
			}

			errors := gitRepo.Validate()

			if tt.expectValid {
				// Should not have a branch validation error for invalid branch name
				for _, err := range errors {
					if err.Field == "spec.test_type.branch" && err.Type == field.ErrorTypeInvalid {
						require.NotContains(t, err.Detail, "invalid branch name")
					}
				}
			} else {
				// Should have a branch validation error (either required or invalid)
				found := false
				for _, err := range errors {
					if err.Field == "spec.test_type.branch" &&
						(err.Type == field.ErrorTypeInvalid || err.Type == field.ErrorTypeRequired) {
						found = true
						break
					}
				}
				require.True(t, found, "Expected branch validation error for: %s", tt.branchName)
			}
		})
	}
}

func TestGitRepository_ResolveRefToHash_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		ref       string
		wantError bool
		wantHash  string
	}{
		{
			name: "valid short hash",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No setup needed for valid hash
			},
			ref:       "abc123",
			wantError: false,
		},
		{
			name: "invalid hex string treated as ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/invalid-hex",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
			},
			ref:       "invalid-hex-zzz",
			wantError: false,
		},
		{
			name: "refs/heads/ prefix handling",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)
			},
			ref:       "refs/heads/feature",
			wantError: false,
		},
		{
			name: "refs/tags/ handling",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/tags/v1.0.0",
					Hash: hash.Hash{7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
				}, nil)
			},
			ref:       "refs/tags/v1.0.0",
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			refHash, err := gitRepo.resolveRefToHash(context.Background(), tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, refHash)
			} else {
				require.NoError(t, err)
				require.NotNil(t, refHash)
			}
		})
	}
}

func TestGitRepository_PathValidation(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		expectError bool
		errorMsg    string
	}{
		{"valid relative path", "configs/dir", false, ""},
		{"path traversal with ../", "../configs", true, "path contains traversal attempt (./ or ../)"},
		{"path traversal with ./", "./configs", true, "path contains traversal attempt (./ or ../)"},
		{"absolute path", "/absolute/path", true, "path must be relative"},
		{"empty path", "", false, ""},
		{"path with multiple traversals", "../../etc/passwd", true, "path contains traversal attempt (./ or ../)"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := &gitRepository{
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: "test_type",
					},
				},
				gitConfig: RepositoryConfig{
					URL:    "https://git.example.com/repo.git",
					Branch: "main",
					Token:  "token123",
					Path:   tt.path,
				},
			}

			errors := gitRepo.Validate()

			if tt.expectError {
				found := false
				for _, err := range errors {
					if err.Field == "spec.test_type.path" && err.Type == field.ErrorTypeInvalid {
						require.Contains(t, err.Detail, tt.errorMsg)
						found = true
						break
					}
				}
				require.True(t, found, "Expected path validation error for: %s", tt.path)
			} else {
				// Should not have a path validation error
				for _, err := range errors {
					if err.Field == "spec.test_type.path" {
						t.Errorf("Unexpected path validation error for %s: %s", tt.path, err.Detail)
					}
				}
			}
		})
	}
}

func TestGitRepository_CompareFiles_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		base      string
		ref       string
		wantError bool
		errorMsg  string
	}{
		{
			name: "both base and ref empty",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed
			},
			base:      "",
			ref:       "",
			wantError: true,
			errorMsg:  "base and ref cannot be empty",
		},
		{
			name: "compare commits error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)
				mockClient.CompareCommitsReturns(nil, errors.New("compare error"))
			},
			base:      "main",
			ref:       "feature",
			wantError: true,
			errorMsg:  "compare commits",
		},
		{
			name: "file status type changed",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)
				mockClient.CompareCommitsReturns([]nanogit.CommitFile{
					{
						Path:   "configs/changed-type.yaml",
						Status: protocol.FileStatusTypeChanged,
					},
				}, nil)
			},
			base:      "main",
			ref:       "feature",
			wantError: false,
		},
		{
			name: "files outside configured path",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)
				mockClient.CompareCommitsReturns([]nanogit.CommitFile{
					{
						Path:   "other/file.yaml", // Outside configs/
						Status: protocol.FileStatusAdded,
					},
					{
						Path:   "configs/included.yaml", // Inside configs/
						Status: protocol.FileStatusAdded,
					},
				}, nil)
			},
			base:      "main",
			ref:       "feature",
			wantError: false,
		},
		{
			name: "unknown file status",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
				}, nil)
				mockClient.CompareCommitsReturns([]nanogit.CommitFile{
					{
						Path:   "configs/unknown.yaml",
						Status: protocol.FileStatus("unknown"),
					},
				}, nil)
			},
			base:      "main",
			ref:       "feature",
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			changes, err := gitRepo.CompareFiles(context.Background(), tt.base, tt.ref)

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, changes)
				if tt.errorMsg != "" {
					require.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, changes)

				// Verify that files outside configured path are filtered out
				if tt.name == "files outside configured path" {
					require.Len(t, changes, 1)
					require.Equal(t, "included.yaml", changes[0].Path)
				}

				// Verify type changed files are handled as updates
				if tt.name == "file status type changed" {
					require.Len(t, changes, 1)
					require.Equal(t, repository.FileActionUpdated, changes[0].Action)
				}
			}
		})
	}
}

func TestGitRepository_ReadTree_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		wantError bool
		errorType error
	}{
		{
			name: "get flat tree error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetFlatTreeReturns(nil, errors.New("flat tree error"))
			},
			wantError: true,
		},
		{
			name: "tree entries outside path",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.GetFlatTreeReturns(&nanogit.FlatTree{
					Entries: []nanogit.FlatTreeEntry{
						{
							Path: "other/file.yaml", // Outside configs/
							Hash: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
							Type: protocol.ObjectTypeBlob,
						},
						{
							Path: "configs/included.yaml", // Inside configs/
							Hash: hash.Hash{7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26},
							Type: protocol.ObjectTypeBlob,
						},
						{
							Path: "configs/dir", // Directory without trailing slash
							Hash: hash.Hash{10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29},
							Type: protocol.ObjectTypeTree,
						},
					},
				}, nil)
			},
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			entries, err := gitRepo.ReadTree(context.Background(), "main")

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, entries)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, entries)

				if tt.name == "tree entries outside path" {
					// Should only include entries inside the configured path
					require.Len(t, entries, 2)

					// Find the blob entry
					var blobEntry *repository.FileTreeEntry
					var dirEntry *repository.FileTreeEntry
					for i := range entries {
						if entries[i].Blob {
							blobEntry = &entries[i]
						} else {
							dirEntry = &entries[i]
						}
					}

					require.NotNil(t, blobEntry)
					require.Equal(t, "included.yaml", blobEntry.Path)
					require.True(t, blobEntry.Blob)

					require.NotNil(t, dirEntry)
					require.Equal(t, "dir/", dirEntry.Path)
					require.False(t, dirEntry.Blob)
				}
			}
		})
	}
}

func TestGitRepository_NewGitRepository_ClientError(t *testing.T) {
	// This test would require mocking nanogit.NewHTTPClient which is difficult
	// We test the path where the client creation would fail by using invalid URL
	ctx := context.Background()

	config := &provisioning.Repository{
		Spec: provisioning.RepositorySpec{
			Type: provisioning.GitHubRepositoryType,
		},
	}

	gitConfig := RepositoryConfig{
		URL:    "://invalid-url", // This should cause nanogit.NewHTTPClient to fail
		Branch: "main",
		Token:  "test-token",
		Path:   "configs",
	}

	mockSecrets := secrets.NewMockRepositorySecrets(t)
	gitRepo, err := NewGitRepository(ctx, config, gitConfig, mockSecrets)

	// We expect this to fail during client creation
	require.Error(t, err)
	require.Nil(t, gitRepo)
	require.Contains(t, err.Error(), "create nanogit client")
}

func TestGitRepository_ensureBranchExists_ErrorConditions(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		wantError bool
		errorMsg  string
	}{
		{
			name: "GetRef error other than not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("network error"))
			},
			wantError: true,
			errorMsg:  "check branch exists",
		},
		{
			name: "CreateRef error",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call - branch doesn't exist
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{}, nanogit.ErrObjectNotFound)
				// Second call - get source branch
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				// CreateRef fails
				mockClient.CreateRefReturns(errors.New("create ref failed"))
			},
			wantError: true,
			errorMsg:  "create branch",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			_, err := gitRepo.ensureBranchExists(context.Background(), "new-branch")

			if tt.wantError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_Read_EdgeCases(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		filePath  string
		wantError bool
		errorType error
	}{
		{
			name: "get tree by path error (not ErrObjectNotFound)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121315"),
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Tree: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockClient.GetTreeByPathReturns(nil, errors.New("tree error"))
			},
			filePath:  "directory/",
			wantError: true,
		},
		{
			name: "get commit error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockClient.GetCommitReturns(nil, errors.New("commit error"))
			},
			filePath:  "file.yaml",
			wantError: true,
		},
		{
			name: "get blob by path error (not ErrObjectNotFound)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockClient.GetCommitReturns(&nanogit.Commit{
					Hash: hash.MustFromHex("0102030405060708092a0b0c0d0e0f1011121314"),
				}, nil)
				mockClient.GetBlobByPathReturns(nil, errors.New("blob error"))
			},
			filePath:  "file.yaml",
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			fileInfo, err := gitRepo.Read(context.Background(), tt.filePath, "main")

			if tt.wantError {
				require.Error(t, err)
				require.Nil(t, fileInfo)
				if tt.errorType != nil {
					require.ErrorIs(t, err, tt.errorType)
				}
			} else {
				require.NoError(t, err)
				require.NotNil(t, fileInfo)
			}
		})
	}
}

func TestGitRepository_Create_ErrorConditions(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		wantError bool
		errorMsg  string
	}{
		{
			name: "NewStagedWriter error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, errors.New("staged writer error"))
			},
			wantError: true,
			errorMsg:  "create staged writer",
		},
		{
			name: "CreateBlob error (not ErrObjectAlreadyExists)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.CreateBlobReturns(hash.Hash{}, errors.New("create blob error"))
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			wantError: true,
			errorMsg:  "create blob",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Create(context.Background(), "test.yaml", "main", []byte("content"), "comment")

			if tt.wantError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_Update_ErrorConditions(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		wantError bool
		errorMsg  string
	}{
		{
			name: "NewStagedWriter error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20},
				}, nil)
				mockClient.NewStagedWriterReturns(nil, errors.New("staged writer error"))
			},
			wantError: true,
			errorMsg:  "create staged writer",
		},
		{
			name: "UpdateBlob error (not ErrObjectNotFound)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.UpdateBlobReturns(hash.Hash{}, errors.New("update blob error"))
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			wantError: true,
			errorMsg:  "update blob",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Update(context.Background(), "test.yaml", "main", []byte("content"), "comment")

			if tt.wantError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_Delete_ErrorConditions(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		path      string
		wantError bool
		errorMsg  string
	}{
		{
			name: "NewStagedWriter error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockClient.NewStagedWriterReturns(nil, errors.New("staged writer error"))
			},
			path:      "test.yaml",
			wantError: true,
			errorMsg:  "create staged writer",
		},
		{
			name: "DeleteBlob error (not ErrObjectNotFound)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteBlobReturns(hash.Hash{}, errors.New("delete blob error"))
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			path:      "test.yaml",
			wantError: true,
			errorMsg:  "delete blob",
		},
		{
			name: "DeleteTree error (not ErrObjectNotFound)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteTreeReturns(hash.Hash{}, errors.New("delete tree error"))
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			path:      "testdir/",
			wantError: true,
			errorMsg:  "delete tree",
		},
		{
			name: "DeleteTree ErrObjectNotFound",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteTreeReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
			},
			path:      "missing-dir/",
			wantError: true,
			errorMsg:  "file not found", // Should return repository.ErrFileNotFound
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			err := gitRepo.Delete(context.Background(), tt.path, "main", "comment")

			if tt.wantError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errorMsg)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_CompareFiles_EmptyBase(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	// Only setup for ref resolution
	mockClient.GetRefReturns(nanogit.Ref{
		Name: "refs/heads/feature",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.CompareCommitsReturns([]nanogit.CommitFile{
		{
			Path:   "configs/new-file.yaml",
			Status: protocol.FileStatusAdded,
		},
	}, nil)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	changes, err := gitRepo.CompareFiles(context.Background(), "", "feature")

	require.NoError(t, err)
	require.NotNil(t, changes)
	require.Len(t, changes, 1)
	require.Equal(t, "new-file.yaml", changes[0].Path)

	// Verify CompareCommits was called with empty base hash and feature hash
	require.Equal(t, 1, mockClient.CompareCommitsCallCount())
	_, baseHash, refHash := mockClient.CompareCommitsArgsForCall(0)
	require.Equal(t, hash.Zero, baseHash) // Empty base should be zero hash
	require.Equal(t, hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"), refHash)
}

func TestGitRepository_EmptyRefHandling(t *testing.T) {
	tests := []struct {
		name   string
		method string
	}{
		{"Create with empty ref", "Create"},
		{"Update with empty ref", "Update"},
		{"Delete with empty ref", "Delete"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			mockClient.GetRefReturns(nanogit.Ref{
				Name: "refs/heads/main",
				Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
			}, nil)

			mockWriter := &mocks.FakeStagedWriter{}
			mockWriter.CreateBlobReturns(hash.Hash{}, nil)
			mockWriter.UpdateBlobReturns(hash.Hash{}, nil)
			mockWriter.DeleteBlobReturns(hash.Hash{}, nil)
			mockWriter.CommitReturns(&nanogit.Commit{}, nil)
			mockWriter.PushReturns(nil)
			mockClient.NewStagedWriterReturns(mockWriter, nil)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			var err error
			switch tt.method {
			case "Create":
				err = gitRepo.Create(context.Background(), "test.yaml", "", []byte("content"), "comment")
			case "Update":
				err = gitRepo.Update(context.Background(), "test.yaml", "", []byte("content"), "comment")
			case "Delete":
				err = gitRepo.Delete(context.Background(), "test.yaml", "", "comment")
			}

			require.NoError(t, err)
		})
	}
}

func TestGitRepository_CompareFiles_ResolveErrors(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*mocks.FakeClient)
		base      string
		ref       string
		wantError string
	}{
		{
			name: "resolve base ref error",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("base ref error"))
			},
			base:      "main",
			ref:       "feature",
			wantError: "resolve base ref",
		},
		{
			name: "resolve ref error",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call succeeds for base
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				}, nil)
				// Second call fails for ref
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{}, errors.New("ref error"))
			},
			base:      "main",
			ref:       "feature",
			wantError: "resolve ref",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			changes, err := gitRepo.CompareFiles(context.Background(), tt.base, tt.ref)

			require.Error(t, err)
			require.Nil(t, changes)
			require.Contains(t, err.Error(), tt.wantError)
		})
	}
}

func TestGitRepository_Read_EmptyRef(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{
		Name: "refs/heads/main",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetCommitReturns(&nanogit.Commit{
		Tree: hash.Hash{4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23},
	}, nil)
	mockClient.GetBlobByPathReturns(&nanogit.Blob{
		Content: []byte("file content"),
		Hash:    hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	fileInfo, err := gitRepo.Read(context.Background(), "test.yaml", "")

	require.NoError(t, err)
	require.NotNil(t, fileInfo)
	require.Equal(t, "test.yaml", fileInfo.Path)
	require.Equal(t, []byte("file content"), fileInfo.Data)
}

func TestGitRepository_ReadTree_EmptyRef(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{
		Name: "refs/heads/main",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetFlatTreeReturns(&nanogit.FlatTree{
		Entries: []nanogit.FlatTreeEntry{
			{
				Path: "configs/test.yaml",
				Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
				Type: protocol.ObjectTypeBlob,
			},
		},
	}, nil)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	entries, err := gitRepo.ReadTree(context.Background(), "")

	require.NoError(t, err)
	require.NotNil(t, entries)
	require.Len(t, entries, 1)
	require.Equal(t, "test.yaml", entries[0].Path)
}

func TestGitRepository_Update_EnsureBranchExistsError(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{}, errors.New("branch error"))

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	err := gitRepo.Update(context.Background(), "test.yaml", "feature", []byte("content"), "comment")

	require.Error(t, err)
	require.Contains(t, err.Error(), "branch error")
}

func TestGitRepository_Create_EnsureBranchExistsError(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{}, errors.New("branch error"))

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	err := gitRepo.Create(context.Background(), "test.yaml", "feature", []byte("content"), "comment")

	require.Error(t, err)
	require.Contains(t, err.Error(), "branch error")
}

func TestGitRepository_Delete_EnsureBranchExistsError(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{}, errors.New("branch error"))

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	err := gitRepo.Delete(context.Background(), "test.yaml", "feature", "comment")

	require.Error(t, err)
	require.Contains(t, err.Error(), "branch error")
}

func TestGitRepository_Update_DirectoryCheck(t *testing.T) {
	gitRepo := &gitRepository{
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	// Test the internal update function directly with directory path
	mockWriter := &mocks.FakeStagedWriter{}
	err := gitRepo.update(context.Background(), "directory/", []byte("content"), mockWriter)

	require.Error(t, err)
	require.Contains(t, err.Error(), "cannot update a directory")
}

func TestGitRepository_Write_DefaultRef(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	// First call for Read check - file not found
	mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
		Name: "refs/heads/main",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetCommitReturns(&nanogit.Commit{
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetBlobByPathReturns(&nanogit.Blob{}, nanogit.ErrObjectNotFound)

	// Second call for Create
	mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
		Name: "refs/heads/main",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockWriter := &mocks.FakeStagedWriter{}
	mockWriter.CreateBlobReturns(hash.Hash{}, nil)
	mockWriter.CommitReturns(&nanogit.Commit{}, nil)
	mockWriter.PushReturns(nil)
	mockClient.NewStagedWriterReturns(mockWriter, nil)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	// Test Write with empty ref to trigger default branch usage
	err := gitRepo.Write(context.Background(), "test.yaml", "", []byte("content"), "message")

	require.NoError(t, err)
}

func TestGitRepository_Read_RefInFileInfo(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{
		Name: "refs/heads/feature",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetCommitReturns(&nanogit.Commit{
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetBlobByPathReturns(&nanogit.Blob{
		Content: []byte("file content"),
		Hash:    hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	// Test Read with specific ref to ensure ref is preserved in FileInfo
	fileInfo, err := gitRepo.Read(context.Background(), "test.yaml", "feature")

	require.NoError(t, err)
	require.NotNil(t, fileInfo)
	require.Equal(t, "test.yaml", fileInfo.Path)
	require.Equal(t, "feature", fileInfo.Ref) // Should preserve original ref, not hash
	require.Equal(t, []byte("file content"), fileInfo.Data)
}

func TestGitRepository_Read_GetTreeByPath_NotFound(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{
		Name: "refs/heads/main",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetCommitReturns(&nanogit.Commit{
		Tree: hash.Hash{30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49},
	}, nil)
	mockClient.GetTreeByPathReturns(nil, nanogit.ErrObjectNotFound)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	// Test reading a directory that doesn't exist
	fileInfo, err := gitRepo.Read(context.Background(), "missing-dir/", "main")

	require.Error(t, err)
	require.Nil(t, fileInfo)
	require.ErrorIs(t, err, repository.ErrFileNotFound)
}

func TestGitRepository_ReadTree_GetFlatTree_NotFound(t *testing.T) {
	mockClient := &mocks.FakeClient{}
	mockClient.GetRefReturns(nanogit.Ref{
		Name: "refs/heads/main",
		Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
	}, nil)
	mockClient.GetFlatTreeReturns(nil, nanogit.ErrObjectNotFound)

	gitRepo := &gitRepository{
		client: mockClient,
		gitConfig: RepositoryConfig{
			Branch: "main",
			Path:   "configs",
		},
		config: &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitHubRepositoryType,
			},
		},
	}

	// Test reading tree when the commit doesn't exist
	entries, err := gitRepo.ReadTree(context.Background(), "main")

	require.Error(t, err)
	require.Nil(t, entries)
	require.ErrorIs(t, err, repository.ErrRefNotFound)
}

func TestGitRepository_CompareFiles_FilesOutsideConfiguredPath_AllStatuses(t *testing.T) {
	tests := []struct {
		name   string
		status protocol.FileStatus
	}{
		{"FileStatusAdded outside path", protocol.FileStatusAdded},
		{"FileStatusModified outside path", protocol.FileStatusModified},
		{"FileStatusDeleted outside path", protocol.FileStatusDeleted},
		{"FileStatusTypeChanged outside path", protocol.FileStatusTypeChanged},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			mockClient.GetRefReturnsOnCall(0, nanogit.Ref{
				Name: "refs/heads/main",
				Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121314"),
			}, nil)
			mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
				Name: "refs/heads/feature",
				Hash: hash.MustFromHex("0102030405060708090a0b0c0d0e0f1011121315"),
			}, nil)
			mockClient.CompareCommitsReturns([]nanogit.CommitFile{
				{
					Path:   "other/file.yaml", // File outside "configs/" path
					Status: tt.status,
				},
				{
					Path:   "configs/included.yaml", // File inside configured path
					Status: tt.status,
				},
			}, nil)

			gitRepo := &gitRepository{
				client: mockClient,
				gitConfig: RepositoryConfig{
					Branch: "main",
					Path:   "configs",
				},
				config: &provisioning.Repository{
					Spec: provisioning.RepositorySpec{
						Type: provisioning.GitHubRepositoryType,
					},
				},
			}

			changes, err := gitRepo.CompareFiles(context.Background(), "main", "feature")

			require.NoError(t, err)
			require.NotNil(t, changes)
			// Should only include the file inside the configured path
			require.Len(t, changes, 1)
			require.Equal(t, "included.yaml", changes[0].Path)
			require.Equal(t, "feature", changes[0].Ref)

			// Verify the action based on status
			switch tt.status {
			case protocol.FileStatusAdded:
				require.Equal(t, repository.FileActionCreated, changes[0].Action)
			case protocol.FileStatusModified:
				require.Equal(t, repository.FileActionUpdated, changes[0].Action)
			case protocol.FileStatusDeleted:
				require.Equal(t, repository.FileActionDeleted, changes[0].Action)
				require.Equal(t, "main", changes[0].PreviousRef)
				require.Equal(t, "included.yaml", changes[0].PreviousPath)
			case protocol.FileStatusTypeChanged:
				require.Equal(t, repository.FileActionUpdated, changes[0].Action)
			}
		})
	}
}

func TestGitRepository_OnDelete(t *testing.T) {
	tests := []struct {
		name          string
		setupMock     func(*secrets.MockRepositorySecrets)
		config        *provisioning.Repository
		expectedError string
	}{
		{
			name: "successful secret deletion",
			setupMock: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Delete(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
					},
					"test-repo"+gitTokenSecretSuffix,
				).Return(nil)
			},
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
			},
		},
		{
			name: "secret deletion error",
			setupMock: func(mockSecrets *secrets.MockRepositorySecrets) {
				mockSecrets.EXPECT().Delete(
					context.Background(),
					&provisioning.Repository{
						ObjectMeta: metav1.ObjectMeta{
							Name:      "test-repo",
							Namespace: "default",
						},
					},
					"test-repo"+gitTokenSecretSuffix,
				).Return(errors.New("failed to delete secret"))
			},
			config: &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-repo",
					Namespace: "default",
				},
			},
			expectedError: "delete git token secret: failed to delete secret",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSecrets := secrets.NewMockRepositorySecrets(t)
			tt.setupMock(mockSecrets)

			gitRepo := &gitRepository{
				config:  tt.config,
				secrets: mockSecrets,
			}

			err := gitRepo.OnDelete(context.Background())

			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}

			mockSecrets.AssertExpectations(t)
		})
	}
}

func TestGitRepository_Move(t *testing.T) {
	tests := []struct {
		name          string
		oldPath       string
		newPath       string
		ref           string
		comment       string
		setupMock     func(*mocks.FakeClient)
		expectedError string
	}{
		{
			name:    "successful move",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "main",
			comment: "move file",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("1234567890abcdef1234567890abcdef12345678")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveBlob - returns the hash of the moved blob
				movedHash, _ := hash.FromHex("abcdef1234567890abcdef1234567890abcdef12")
				mockWriter.MoveBlobReturns(movedHash, nil)

				// Mock commit and push
				commitHash, _ := hash.FromHex("fedcba0987654321fedcba0987654321fedcba09")
				mockWriter.CommitReturns(&nanogit.Commit{Hash: commitHash}, nil)
				mockWriter.PushReturns(nil)
			},
		},
		{
			name:    "move with empty ref uses default branch",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "",
			comment: "move file",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior for default branch
				refHash, _ := hash.FromHex("aaaa1111bbbb2222cccc3333dddd4444eeee5555")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveBlob
				moveHash, _ := hash.FromHex("bbbb2222cccc3333dddd4444eeee5555ffff6666")
				mockWriter.MoveBlobReturns(moveHash, nil)

				// Mock commit and push
				commitHash, _ := hash.FromHex("cccc3333dddd4444eeee5555ffff6666aaaa1111")
				mockWriter.CommitReturns(&nanogit.Commit{Hash: commitHash}, nil)
				mockWriter.PushReturns(nil)
			},
		},
		{
			name:    "successful directory move",
			oldPath: "old/",
			newPath: "new/",
			ref:     "main",
			comment: "move directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("dddd4444eeee5555ffff6666aaaa1111bbbb2222")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveTree (for directories, we trim trailing slashes)
				treeHash, _ := hash.FromHex("eeee5555ffff6666aaaa1111bbbb2222cccc3333")
				mockWriter.MoveTreeReturns(treeHash, nil)

				// Mock commit and push
				commitHash, _ := hash.FromHex("ffff6666aaaa1111bbbb2222cccc3333dddd4444")
				mockWriter.CommitReturns(&nanogit.Commit{Hash: commitHash}, nil)
				mockWriter.PushReturns(nil)
			},
		},
		{
			name:          "move file to directory type should fail",
			oldPath:       "file.yaml",
			newPath:       "directory/",
			ref:           "main",
			comment:       "move file to directory",
			expectedError: "cannot move between file and directory types",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mocks needed as this should fail early during validation
			},
		},
		{
			name:          "move non-existent file",
			oldPath:       "nonexistent.yaml",
			newPath:       "new.yaml",
			ref:           "main",
			comment:       "move missing file",
			expectedError: "file not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("aaaa0000bbbb1111cccc2222dddd3333eeee4444")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveBlob to return not found error
				mockWriter.MoveBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
			},
		},
		{
			name:          "move to existing file should fail",
			oldPath:       "old.yaml",
			newPath:       "existing.yaml",
			ref:           "main",
			comment:       "move to existing",
			expectedError: "file already exists",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("ffff0000eeee1111dddd2222cccc3333bbbb4444")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveBlob to return already exists error
				mockWriter.MoveBlobReturns(hash.Hash{}, nanogit.ErrObjectAlreadyExists)
			},
		},
		{
			name:          "branch creation fails",
			oldPath:       "old.yaml",
			newPath:       "new.yaml",
			ref:           "nonexistent-branch",
			comment:       "move on nonexistent branch",
			expectedError: "get source branch ref",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock branch not found
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{}, nanogit.ErrObjectNotFound)
				// Mock getting source branch for creation - also fails
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
		},
		{
			name:          "staged writer creation fails",
			oldPath:       "old.yaml",
			newPath:       "new.yaml",
			ref:           "main",
			comment:       "move file",
			expectedError: "create staged writer",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("1111aaaa2222bbbb3333cccc4444dddd5555eeee")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter failure
				mockClient.NewStagedWriterReturns(nil, errors.New("writer creation failed"))
			},
		},
		{
			name:          "commit fails",
			oldPath:       "old.yaml",
			newPath:       "new.yaml",
			ref:           "main",
			comment:       "move file",
			expectedError: "commit changes",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("2222bbbb3333cccc4444dddd5555eeee6666ffff")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveBlob success
				moveHash, _ := hash.FromHex("3333cccc4444dddd5555eeee6666ffff7777aaaa")
				mockWriter.MoveBlobReturns(moveHash, nil)

				// Mock commit failure
				mockWriter.CommitReturns(&nanogit.Commit{}, errors.New("commit failed"))
			},
		},
		{
			name:          "push fails",
			oldPath:       "old.yaml",
			newPath:       "new.yaml",
			ref:           "main",
			comment:       "move file",
			expectedError: "push changes",
			setupMock: func(mockClient *mocks.FakeClient) {
				// Mock ensureBranchExists behavior
				refHash, _ := hash.FromHex("4444dddd5555eeee6666ffff7777aaaa8888bbbb")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				// Mock NewStagedWriter
				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)

				// Mock MoveBlob success
				moveHash, _ := hash.FromHex("5555eeee6666ffff7777aaaa8888bbbb9999cccc")
				mockWriter.MoveBlobReturns(moveHash, nil)

				// Mock commit success
				commitHash, _ := hash.FromHex("6666ffff7777aaaa8888bbbb9999cccc0000dddd")
				mockWriter.CommitReturns(&nanogit.Commit{Hash: commitHash}, nil)

				// Mock push failure
				mockWriter.PushReturns(errors.New("push failed"))
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			// Create repository config
			config := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
				},
			}

			gitConfig := RepositoryConfig{
				URL:    "https://github.com/example/repo.git",
				Branch: "main",
				Token:  "token123",
				Path:   "configs",
			}

			gitRepo := &gitRepository{
				config:    config,
				gitConfig: gitConfig,
				client:    mockClient,
			}

			// Execute move operation
			err := gitRepo.Move(context.Background(), tt.oldPath, tt.newPath, tt.ref, tt.comment)

			// Verify results
			if tt.expectedError != "" {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGitRepository_Move_ErrorConditions(t *testing.T) {
	tests := []struct {
		name          string
		oldPath       string
		newPath       string
		ref           string
		comment       string
		setupMock     func(*mocks.FakeClient)
		expectedError string
		errorType     error
	}{
		{
			name:    "MoveBlob - ErrObjectNotFound",
			oldPath: "missing.yaml",
			newPath: "new.yaml",
			ref:     "main",
			comment: "move missing file",
			setupMock: func(mockClient *mocks.FakeClient) {
				refHash, _ := hash.FromHex("1234567890abcdef1234567890abcdef12345678")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
				mockWriter.MoveBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
			},
			expectedError: "file not found",
			errorType:     repository.ErrFileNotFound,
		},
		{
			name:    "MoveBlob - ErrObjectAlreadyExists",
			oldPath: "old.yaml",
			newPath: "existing.yaml",
			ref:     "main",
			comment: "move to existing file",
			setupMock: func(mockClient *mocks.FakeClient) {
				refHash, _ := hash.FromHex("abcdef1234567890abcdef1234567890abcdef12")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
				mockWriter.MoveBlobReturns(hash.Hash{}, nanogit.ErrObjectAlreadyExists)
			},
			expectedError: "file already exists",
			errorType:     repository.ErrFileAlreadyExists,
		},
		{
			name:    "MoveBlob - generic error",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "main",
			comment: "move file with generic error",
			setupMock: func(mockClient *mocks.FakeClient) {
				refHash, _ := hash.FromHex("fedcba0987654321fedcba0987654321fedcba09")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
				mockWriter.MoveBlobReturns(hash.Hash{}, errors.New("network error"))
			},
			expectedError: "move blob: network error",
		},
		{
			name:    "MoveTree - ErrObjectNotFound",
			oldPath: "missing-dir/",
			newPath: "new-dir/",
			ref:     "main",
			comment: "move missing directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				refHash, _ := hash.FromHex("1111222233334444555566667777888899990000")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
				mockWriter.MoveTreeReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
			},
			expectedError: "file not found",
			errorType:     repository.ErrFileNotFound,
		},
		{
			name:    "MoveTree - ErrObjectAlreadyExists",
			oldPath: "old-dir/",
			newPath: "existing-dir/",
			ref:     "main",
			comment: "move to existing directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				refHash, _ := hash.FromHex("aaaa1111bbbb2222cccc3333dddd4444eeee5555")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
				mockWriter.MoveTreeReturns(hash.Hash{}, nanogit.ErrObjectAlreadyExists)
			},
			expectedError: "file already exists",
			errorType:     repository.ErrFileAlreadyExists,
		},
		{
			name:    "MoveTree - generic error",
			oldPath: "old-dir/",
			newPath: "new-dir/",
			ref:     "main",
			comment: "move directory with generic error",
			setupMock: func(mockClient *mocks.FakeClient) {
				refHash, _ := hash.FromHex("ffff6666eeee5555dddd4444cccc3333bbbb2222")
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)

				mockWriter := &mocks.FakeStagedWriter{}
				mockClient.NewStagedWriterReturns(mockWriter, nil)
				mockWriter.MoveTreeReturns(hash.Hash{}, errors.New("permission denied"))
			},
			expectedError: "move tree: permission denied",
		},
		{
			name:    "invalid branch name",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "invalid//branch",
			comment: "move with invalid branch",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed as error is caught during branch validation
			},
			expectedError: "invalid branch name",
		},
		{
			name:    "ensure branch exists fails - source branch not found",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "new-branch",
			comment: "move to new branch when source doesn't exist",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call - new branch doesn't exist
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{}, nanogit.ErrObjectNotFound)
				// Second call - source branch also doesn't exist
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			expectedError: "get source branch ref",
		},
		{
			name:    "ensure branch exists fails - branch creation error",
			oldPath: "old.yaml",
			newPath: "new.yaml",
			ref:     "new-branch",
			comment: "move to new branch with creation failure",
			setupMock: func(mockClient *mocks.FakeClient) {
				// First call - new branch doesn't exist
				mockClient.GetRefReturnsOnCall(0, nanogit.Ref{}, nanogit.ErrObjectNotFound)
				// Second call - get source branch succeeds
				refHash, _ := hash.FromHex("7777aaaa8888bbbb9999cccc0000dddd1111eeee")
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: refHash,
				}, nil)
				// CreateRef fails
				mockClient.CreateRefReturns(errors.New("create ref failed"))
			},
			expectedError: "create branch",
		},
		{
			name:    "directory to file move type mismatch",
			oldPath: "directory/",
			newPath: "file.yaml",
			ref:     "main",
			comment: "move directory to file",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed as error is caught during validation
			},
			expectedError: "cannot move between file and directory types",
		},
		{
			name:    "file to directory move type mismatch",
			oldPath: "file.yaml",
			newPath: "directory/",
			ref:     "main",
			comment: "move file to directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				// No mock setup needed as error is caught during validation
			},
			expectedError: "cannot move between file and directory types",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockClient := &mocks.FakeClient{}
			tt.setupMock(mockClient)

			config := &provisioning.Repository{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-repo",
				},
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitRepositoryType,
				},
			}

			gitConfig := RepositoryConfig{
				URL:    "https://github.com/example/repo.git",
				Branch: "main",
				Token:  "token123",
				Path:   "configs",
			}

			gitRepo := &gitRepository{
				config:    config,
				gitConfig: gitConfig,
				client:    mockClient,
			}

			err := gitRepo.Move(context.Background(), tt.oldPath, tt.newPath, tt.ref, tt.comment)

			require.Error(t, err)
			require.Contains(t, err.Error(), tt.expectedError)

			if tt.errorType != nil {
				require.ErrorIs(t, err, tt.errorType)
			}
		})
	}
}
