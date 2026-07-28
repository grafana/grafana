package v0alpha1

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConnections_IsGitHub(t *testing.T) {
	tests := []struct {
		name            string
		want            bool
		connectionInput ConnectionSpec
	}{
		{
			name: "github spec returns true",
			want: true,
			connectionInput: ConnectionSpec{
				GitHub: &GitHubConnectionConfig{},
			},
		},
		{
			name: "githubEnterprise spec returns true",
			want: true,
			connectionInput: ConnectionSpec{
				GitHubEnterprise: &GitHubEnterpriseConnectionConfig{},
			},
		},
		{
			name: "gitlab spec returns false",
			connectionInput: ConnectionSpec{
				Gitlab: &GitlabConnectionConfig{},
			},
		},
		{
			name: "bitbucket spec returns false",
			connectionInput: ConnectionSpec{
				Bitbucket: &BitbucketConnectionConfig{},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, tt.connectionInput.IsGitHub())
		})
	}
}
