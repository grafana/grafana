package v0alpha1_test

import (
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/assert"
)

func TestRepository_ConnectionName(t *testing.T) {
	tests := []struct {
		name string
		repo v0alpha1.Repository
		want string
	}{
		{
			name: "no connection",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.GitHubRepositoryType,
				},
			},
			want: "",
		},
		{
			name: "with connection",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.GitHubRepositoryType,
					Connection: &v0alpha1.ConnectionInfo{
						Name: "my-github-connection",
					},
				},
			},
			want: "my-github-connection",
		},
		{
			name: "local repository without connection",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.LocalRepositoryType,
				},
			},
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.repo.ConnectionName()
			if got != tt.want {
				t.Errorf("ConnectionName() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestRepositoryType_IsGitHub(t *testing.T) {
	tests := []struct {
		name     string
		repoType v0alpha1.RepositoryType
		want     bool
	}{
		{
			name:     "github",
			repoType: v0alpha1.GitHubRepositoryType,
			want:     true,
		},
		{
			name:     "githubEnterprise",
			repoType: v0alpha1.GitHubEnterpriseRepositoryType,
			want:     true,
		},
		{
			name:     "git",
			repoType: v0alpha1.GitRepositoryType,
			want:     false,
		},
		{
			name:     "gitlab",
			repoType: v0alpha1.GitLabRepositoryType,
			want:     false,
		},
		{
			name:     "bitbucket",
			repoType: v0alpha1.BitbucketRepositoryType,
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.repoType.IsGitHub())
		})
	}
}

func TestRepositoryType_IsGit(t *testing.T) {
	tests := []struct {
		name     string
		repoType v0alpha1.RepositoryType
		want     bool
	}{
		{
			name:     "git",
			repoType: v0alpha1.GitRepositoryType,
			want:     true,
		},
		{
			name:     "github",
			repoType: v0alpha1.GitHubRepositoryType,
			want:     true,
		},
		{
			name:     "bitbucket",
			repoType: v0alpha1.BitbucketRepositoryType,
			want:     true,
		},
		{
			name:     "gitlab",
			repoType: v0alpha1.GitLabRepositoryType,
			want:     true,
		},
		{
			name:     "local",
			repoType: v0alpha1.LocalRepositoryType,
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.repoType.IsGit()
			if got != tt.want {
				t.Errorf("IsGit() = %v, want %v", got, tt.want)
			}
		})
	}
}
