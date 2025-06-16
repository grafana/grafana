package nanogit

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/nanogit"
	"github.com/grafana/nanogit/mocks"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestGitRepository_Validate(t *testing.T) {
	tests := []struct {
		name      string
		config    *provisioning.Repository
		gitConfig RepositoryConfig
		want      int // number of expected validation errors
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
			want: 0,
		},
		{
			name: "missing git config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{},
			},
			want: 3, // URL, branch, and token are all required
		},
		{
			name: "missing URL",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
				Token:  "token123",
			},
			want: 1,
		},
		{
			name: "invalid URL scheme",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "http://git.example.com/repo.git",
				Branch: "main",
				Token:  "token123",
			},
			want: 1,
		},
		{
			name: "missing branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "", // Empty branch
				Token:  "token123",
			},
			want: 1,
		},
		{
			name: "missing token",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "", // Empty token
			},
			want: 1,
		},
		{
			name: "absolute path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Type: provisioning.GitHubRepositoryType,
				},
			},
			gitConfig: RepositoryConfig{
				URL:    "https://git.example.com/repo.git",
				Branch: "main",
				Token:  "token123",
				Path:   "/absolute/path",
			},
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := &gitRepository{
				config:    tt.config,
				gitConfig: tt.gitConfig,
			}

			errors := gitRepo.Validate()
			require.Len(t, errors, tt.want)
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

// Mock secrets service for testing
type mockSecretsService struct{}

func (m *mockSecretsService) Decrypt(ctx context.Context, data []byte) ([]byte, error) {
	return []byte("decrypted-token"), nil
}

func (m *mockSecretsService) Encrypt(ctx context.Context, data []byte) ([]byte, error) {
	return []byte("encrypted-token"), nil
}

func TestNewGit(t *testing.T) {
	ctx := context.Background()
	mockSecrets := &mockSecretsService{}

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

	// This should succeed in creating the client but won't be able to connect
	// We just test that the basic structure is created correctly
	gitRepo, err := NewGitRepository(ctx, mockSecrets, config, gitConfig)
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
		wantSuccess bool
		wantErrors  int
		wantCode    int
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
			wantSuccess: true,
			wantErrors:  0,
			wantCode:    http.StatusOK,
		},
		{
			name: "failure - not authorized (error)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(false, errors.New("auth error"))
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantSuccess: false,
			wantErrors:  1,
			wantCode:    http.StatusBadRequest,
		},
		{
			name: "failure - not authorized (false result)",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(false, nil)
			},
			gitConfig: RepositoryConfig{
				Branch: "main",
			},
			wantSuccess: false,
			wantErrors:  1,
			wantCode:    http.StatusBadRequest,
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
			wantSuccess: false,
			wantErrors:  1,
			wantCode:    http.StatusBadRequest,
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
			wantSuccess: false,
			wantErrors:  1,
			wantCode:    http.StatusBadRequest,
		},
		{
			name: "failure - branch not found",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(true, nil)
				mockClient.GetRefReturns(nanogit.Ref{}, errors.New("branch not found"))
			},
			gitConfig: RepositoryConfig{
				Branch: "nonexistent",
			},
			wantSuccess: false,
			wantErrors:  1,
			wantCode:    http.StatusBadRequest,
		},
		{
			name: "failure - GetRef returns nanogit.ErrObjectNotFound",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.IsAuthorizedReturns(true, nil)
				mockClient.RepoExistsReturns(true, nil)
				mockClient.GetRefReturns(nanogit.Ref{}, nanogit.ErrObjectNotFound)
			},
			gitConfig: RepositoryConfig{
				Branch: "missing-branch",
			},
			wantSuccess: false,
			wantErrors:  1,
			wantCode:    http.StatusBadRequest,
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

			results, err := gitRepo.Test(context.Background())
			require.NoError(t, err, "Test method should not return an error")

			require.Equal(t, tt.wantSuccess, results.Success, "Success status mismatch")
			require.Equal(t, tt.wantErrors, len(results.Errors), "Number of errors mismatch")
			require.Equal(t, tt.wantCode, results.Code, "HTTP status code mismatch")

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

			// Verify error details for failed tests
			if !tt.wantSuccess && len(results.Errors) > 0 {
				err := results.Errors[0]
				require.Equal(t, metav1.CauseTypeFieldValueInvalid, err.Type, "Error type should be FieldValueInvalid")
				require.NotEmpty(t, err.Field, "Error field should not be empty")
				require.NotEmpty(t, err.Detail, "Error detail should not be empty")
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
			name: "success - read directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
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
						Type: provisioning.GitHubRepositoryType,
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
		name      string
		setupMock func(*mocks.FakeClient)
		gitConfig RepositoryConfig
		path      string
		ref       string
		comment   string
		wantError bool
		errorType error
	}{
		{
			name: "success - delete file",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteBlobReturns(hash.Hash{}, nil)
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
			comment:   "Delete test file",
			wantError: false,
		},
		{
			name: "success - delete directory",
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteTreeReturns(hash.Hash{}, nil)
				mockWriter.CommitReturns(&nanogit.Commit{}, nil)
				mockWriter.PushReturns(nil)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
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
			setupMock: func(mockClient *mocks.FakeClient) {
				mockClient.GetRefReturns(nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{},
				}, nil)
				mockWriter := &mocks.FakeStagedWriter{}
				mockWriter.DeleteBlobReturns(hash.Hash{}, nanogit.ErrObjectNotFound)
				mockClient.NewStagedWriterReturns(mockWriter, nil)
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

			err := gitRepo.Delete(context.Background(), tt.path, tt.ref, tt.comment)

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
					Hash: hash.Hash{1, 2, 3}, // Non-empty hash
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
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/feature",
					Hash: hash.Hash{4, 5, 6},
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
					Hash: hash.Hash{1, 2, 3},
				}, nil)
				mockClient.GetRefReturnsOnCall(1, nanogit.Ref{
					Name: "refs/heads/main",
					Hash: hash.Hash{1, 2, 3},
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
					Hash: hash.Hash{1, 2, 3},
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
					Hash: hash.Hash{1, 2, 3},
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
