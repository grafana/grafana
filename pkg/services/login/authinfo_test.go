package login

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsKnownAuthModule(t *testing.T) {
	knownModules := []string{
		PasswordAuthModule, PasswordlessAuthModule, APIKeyAuthModule,
		SAMLAuthModule, LDAPAuthModule, AuthProxyAuthModule,
		JWTModule, ExtendedJWTModule, RenderModule,
		AzureADAuthModule, GoogleAuthModule, GitLabAuthModule,
		GithubAuthModule, GenericOAuthModule, GrafanaComAuthModule,
		GrafanaNetAuthModule, OktaAuthModule,
	}

	for _, module := range knownModules {
		t.Run("known module "+module, func(t *testing.T) {
			assert.True(t, IsKnownAuthModule(module))
		})
	}

	unknownModules := []string{
		"oauth_unknown", "custom_auth", "", "google", "oauth_",
	}

	for _, module := range unknownModules {
		t.Run("unknown module "+module, func(t *testing.T) {
			assert.False(t, IsKnownAuthModule(module))
		})
	}
}
