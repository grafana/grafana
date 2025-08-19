package v0alpha1_test

import (
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

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
