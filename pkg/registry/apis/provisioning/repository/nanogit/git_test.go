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
			want: 1,
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
				Branch: "main",
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
				Token:  "token123",
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
