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

func TestRepository_SetBranch(t *testing.T) {
	t.Run("writes the provider-specific spec field and round-trips through Branch()", func(t *testing.T) {
		tests := []struct {
			name string
			repo v0alpha1.Repository
			// field returns the branch from the provider config the test set up, so we can assert
			// SetBranch wrote the correct field (not just that Branch() happens to agree).
			field func(r *v0alpha1.Repository) string
		}{
			{
				name: "github",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:   v0alpha1.GitHubRepositoryType,
					GitHub: &v0alpha1.GitHubRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.GitHub.Branch },
			},
			{
				name: "githubEnterprise",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:             v0alpha1.GitHubEnterpriseRepositoryType,
					GitHubEnterprise: &v0alpha1.GitHubEnterpriseRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.GitHubEnterprise.Branch },
			},
			{
				name: "git",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.GitRepositoryType,
					Git:  &v0alpha1.GitRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.Git.Branch },
			},
			{
				name: "gitlab",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:   v0alpha1.GitLabRepositoryType,
					GitLab: &v0alpha1.GitLabRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.GitLab.Branch },
			},
			{
				name: "bitbucket",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:      v0alpha1.BitbucketRepositoryType,
					Bitbucket: &v0alpha1.BitbucketRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.Bitbucket.Branch },
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				repo := tt.repo
				repo.SetBranch("feature")
				assert.Equal(t, "feature", tt.field(&repo), "should write the provider-specific spec field")
				assert.Equal(t, "feature", repo.Branch(), "Branch() should reflect the value written by SetBranch")
			})
		}
	})

	t.Run("is a no-op and does not panic when the provider config is absent", func(t *testing.T) {
		// Regression: SetBranch previously assumed Spec.GitHub and panicked for types whose config
		// lives elsewhere (e.g. GitHub Enterprise) or is nil.
		tests := []struct {
			name string
			repo v0alpha1.Repository
		}{
			{
				name: "github type with nil GitHub config",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{Type: v0alpha1.GitHubRepositoryType}},
			},
			{
				name: "githubEnterprise type with nil GitHubEnterprise config",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{Type: v0alpha1.GitHubEnterpriseRepositoryType}},
			},
			{
				name: "local (non-git) type",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{Type: v0alpha1.LocalRepositoryType}},
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				repo := tt.repo
				assert.NotPanics(t, func() { repo.SetBranch("feature") })
				assert.Equal(t, "", repo.Branch())
			})
		}
	})
}
