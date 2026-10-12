package gitoauth_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/gitoauth"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestExtra_Validate(t *testing.T) {
	tests := []struct {
		name          string
		gitOAuth      *provisioning.GitOAuthConnectionConfig
		allowInsecure bool
		errorContains []string
	}{
		{
			name:          "missing gitOAuth config",
			errorContains: []string{"gitOAuth info must be specified"},
		},
		{
			name:          "missing endpoints",
			gitOAuth:      &provisioning.GitOAuthConnectionConfig{},
			errorContains: []string{"spec.gitOAuth.authURL", "spec.gitOAuth.tokenURL", "an OAuth endpoint URL is required"},
		},
		{
			name: "unsupported scheme",
			gitOAuth: &provisioning.GitOAuthConnectionConfig{
				AuthURL:  "ftp://git.example.com/oauth/authorize",
				TokenURL: "https://git.example.com/oauth/token",
			},
			errorContains: []string{"spec.gitOAuth.authURL", "URL must start with https:// or http://"},
		},
		{
			name: "missing host",
			gitOAuth: &provisioning.GitOAuthConnectionConfig{
				AuthURL:  "https://git.example.com/oauth/authorize",
				TokenURL: "https:///oauth/token",
			},
			errorContains: []string{"spec.gitOAuth.tokenURL", "must be an absolute URL with a host"},
		},
		{
			name: "http endpoints rejected when insecure is not allowed",
			gitOAuth: &provisioning.GitOAuthConnectionConfig{
				AuthURL:  "http://git.example.com/oauth/authorize",
				TokenURL: "HTTP://git.example.com/oauth/token",
			},
			errorContains: []string{"spec.gitOAuth.authURL", "spec.gitOAuth.tokenURL", "http:// is not allowed"},
		},
		{
			name: "http endpoints allowed when insecure is allowed",
			gitOAuth: &provisioning.GitOAuthConnectionConfig{
				AuthURL:  "http://git.example.com/oauth/authorize",
				TokenURL: "http://git.example.com/oauth/token",
			},
			allowInsecure: true,
		},
		{
			name: "https endpoints",
			gitOAuth: &provisioning.GitOAuthConnectionConfig{
				AuthURL:  "https://git.example.com/oauth/authorize",
				TokenURL: "https://git.example.com/oauth/token",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := &provisioning.Connection{
				Spec: provisioning.ConnectionSpec{
					Type:     provisioning.GitOAuthConnectionType,
					OAuth:    &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
					GitOAuth: tt.gitOAuth,
				},
				Secure: provisioning.ConnectionSecure{
					ClientSecret: common.InlineSecureValue{Create: common.NewSecretValue("client-secret")},
				},
			}

			list := gitoauth.Extra(nil, tt.allowInsecure).Validate(t.Context(), conn)
			if len(tt.errorContains) == 0 {
				assert.Empty(t, list)
				return
			}
			require.NotEmpty(t, list)
			errStr := list.ToAggregate().Error()
			for _, contains := range tt.errorContains {
				assert.Contains(t, errStr, contains)
			}
		})
	}
}
