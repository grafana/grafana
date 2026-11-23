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
					Type: v0alpha1.RepositorySpecTypeGithub,
				},
			},
			want: "",
		},
		{
			name: "with connection",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.RepositorySpecTypeGithub,
					Connection: &v0alpha1.RepositoryConnectionInfo{
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
					Type: v0alpha1.RepositorySpecTypeLocal,
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
		repoType v0alpha1.RepositorySpecType
		want     bool
	}{
		{
			name:     "github",
			repoType: v0alpha1.RepositorySpecTypeGithub,
			want:     true,
		},
		{
			name:     "githubEnterprise",
			repoType: v0alpha1.RepositorySpecTypeGithubEnterprise,
			want:     true,
		},
		{
			name:     "git",
			repoType: v0alpha1.RepositorySpecTypeGit,
			want:     false,
		},
		{
			name:     "gitlab",
			repoType: v0alpha1.RepositorySpecTypeGitlab,
			want:     false,
		},
		{
			name:     "bitbucket",
			repoType: v0alpha1.RepositorySpecTypeBitbucket,
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
		repoType v0alpha1.RepositorySpecType
		want     bool
	}{
		{
			name:     "git",
			repoType: v0alpha1.RepositorySpecTypeGit,
			want:     true,
		},
		{
			name:     "github",
			repoType: v0alpha1.RepositorySpecTypeGithub,
			want:     true,
		},
		{
			name:     "bitbucket",
			repoType: v0alpha1.RepositorySpecTypeBitbucket,
			want:     true,
		},
		{
			name:     "gitlab",
			repoType: v0alpha1.RepositorySpecTypeGitlab,
			want:     true,
		},
		{
			name:     "local",
			repoType: v0alpha1.RepositorySpecTypeLocal,
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
					Type:   v0alpha1.RepositorySpecTypeGithub,
					Github: &v0alpha1.RepositoryGitHubRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.Github.Branch },
			},
			{
				name: "githubEnterprise",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:             v0alpha1.RepositorySpecTypeGithubEnterprise,
					GithubEnterprise: &v0alpha1.RepositoryGitHubEnterpriseRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.GithubEnterprise.Branch },
			},
			{
				name: "git",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.RepositorySpecTypeGit,
					Git:  &v0alpha1.RepositoryGitRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.Git.Branch },
			},
			{
				name: "gitlab",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:   v0alpha1.RepositorySpecTypeGitlab,
					Gitlab: &v0alpha1.RepositoryGitLabRepositoryConfig{},
				}},
				field: func(r *v0alpha1.Repository) string { return r.Spec.Gitlab.Branch },
			},
			{
				name: "bitbucket",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{
					Type:      v0alpha1.RepositorySpecTypeBitbucket,
					Bitbucket: &v0alpha1.RepositoryBitbucketRepositoryConfig{},
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
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{Type: v0alpha1.RepositorySpecTypeGithub}},
			},
			{
				name: "githubEnterprise type with nil GitHubEnterprise config",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{Type: v0alpha1.RepositorySpecTypeGithubEnterprise}},
			},
			{
				name: "local (non-git) type",
				repo: v0alpha1.Repository{Spec: v0alpha1.RepositorySpec{Type: v0alpha1.RepositorySpecTypeLocal}},
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

func TestRepository_ShouldGenerateDashboardPreviews(t *testing.T) {
	tests := []struct {
		name string
		repo v0alpha1.Repository
		want bool
	}{
		{
			name: "github with previews enabled",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type:   v0alpha1.RepositorySpecTypeGithub,
					Github: &v0alpha1.RepositoryGitHubRepositoryConfig{GenerateDashboardPreviews: true},
				},
			},
			want: true,
		},
		{
			name: "github with previews disabled",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type:   v0alpha1.RepositorySpecTypeGithub,
					Github: &v0alpha1.RepositoryGitHubRepositoryConfig{GenerateDashboardPreviews: false},
				},
			},
			want: false,
		},
		{
			name: "github type with nil github config",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.RepositorySpecTypeGithub,
				},
			},
			want: false,
		},
		{
			name: "githubEnterprise with previews enabled via pull request options",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type:        v0alpha1.RepositorySpecTypeGithubEnterprise,
					PullRequest: &v0alpha1.RepositoryPullRequestOptions{GenerateDashboardPreviews: true},
				},
			},
			want: true,
		},
		{
			name: "githubEnterprise with previews disabled via pull request options",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type:        v0alpha1.RepositorySpecTypeGithubEnterprise,
					PullRequest: &v0alpha1.RepositoryPullRequestOptions{GenerateDashboardPreviews: false},
				},
			},
			want: false,
		},
		{
			name: "githubEnterprise type with nil pull request options",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.RepositorySpecTypeGithubEnterprise,
				},
			},
			want: false,
		},
		{
			name: "gitlab with previews enabled via pull request options",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type:        v0alpha1.RepositorySpecTypeGitlab,
					PullRequest: &v0alpha1.RepositoryPullRequestOptions{GenerateDashboardPreviews: true},
				},
			},
			want: true,
		},
		{
			name: "non-github type with nil pull request options returns false",
			repo: v0alpha1.Repository{
				Spec: v0alpha1.RepositorySpec{
					Type: v0alpha1.RepositorySpecTypeGitlab,
				},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.repo.ShouldGenerateDashboardPreviews())
		})
	}
}

func TestRepositoryType_AllowsSecureValues(t *testing.T) {
	gitTypes := []v0alpha1.RepositorySpecType{
		v0alpha1.RepositorySpecTypeGithub,
		v0alpha1.RepositorySpecTypeGithubEnterprise,
		v0alpha1.RepositorySpecTypeGit,
		v0alpha1.RepositorySpecTypeBitbucket,
		v0alpha1.RepositorySpecTypeGitlab,
	}
	for _, repoType := range gitTypes {
		t.Run(string(repoType), func(t *testing.T) {
			assert.False(t, repoType.AllowsSecureValues())
		})
	}

	t.Run("local", func(t *testing.T) {
		assert.True(t, v0alpha1.RepositorySpecTypeLocal.AllowsSecureValues())
	})
}
