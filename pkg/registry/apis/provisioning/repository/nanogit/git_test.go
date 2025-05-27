package nanogit

import (
	"context"
	"testing"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/stretchr/testify/require"
)

func TestGitRepository_Validate(t *testing.T) {
	tests := []struct {
		name   string
		config *provisioning.Repository
		want   int // number of expected validation errors
	}{
		{
			name: "valid config",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
						Token:  "token123",
						Path:   "configs",
					},
				},
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
					Git: &provisioning.GitRepositoryConfig{
						Branch: "main",
						Token:  "token123",
					},
				},
			},
			want: 1,
		},
		{
			name: "invalid URL scheme",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Git: &provisioning.GitRepositoryConfig{
						URL:    "http://git.example.com/repo.git",
						Branch: "main",
						Token:  "token123",
					},
				},
			},
			want: 1,
		},
		{
			name: "missing branch",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Git: &provisioning.GitRepositoryConfig{
						URL:   "https://git.example.com/repo.git",
						Token: "token123",
					},
				},
			},
			want: 1,
		},
		{
			name: "missing token",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
					},
				},
			},
			want: 1,
		},
		{
			name: "absolute path",
			config: &provisioning.Repository{
				Spec: provisioning.RepositorySpec{
					Git: &provisioning.GitRepositoryConfig{
						URL:    "https://git.example.com/repo.git",
						Branch: "main",
						Token:  "token123",
						Path:   "/absolute/path",
					},
				},
			},
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gitRepo := &gitRepository{
				config: tt.config,
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
			Git: &provisioning.GitRepositoryConfig{
				URL:    "https://git.example.com/owner/repo.git",
				Branch: "main",
				Token:  "test-token",
				Path:   "configs",
			},
		},
	}

	// This should succeed in creating the client but won't be able to connect
	// We just test that the basic structure is created correctly
	gitRepo, err := NewGit(ctx, config, mockSecrets, func(ctx context.Context, opts repository.CloneOptions) (repository.ClonedRepository, error) {
		return nil, nil
	})

	require.NoError(t, err)
	require.NotNil(t, gitRepo)
	require.Equal(t, "https://git.example.com/owner/repo.git", gitRepo.URL())
	require.Equal(t, "main", gitRepo.Branch())
	require.Equal(t, config, gitRepo.Config())
}
