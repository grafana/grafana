package v0alpha1

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestEncodeName(t *testing.T) {
	tests := []struct {
		userUID    string
		authModule string
		want       string
	}{
		{"abc123", "ldap", "abc123.ldap"},
		{"abc123", "oauth_github", "abc123.oauth-github"},
		{"abc123", "auth.saml", "abc123.auth.saml"},
	}
	for _, tt := range tests {
		require.Equal(t, tt.want, EncodeName(tt.userUID, tt.authModule))

		userUID, authModule, ok := DecodeName(tt.want)
		require.True(t, ok)
		require.Equal(t, tt.userUID, userUID)
		require.Equal(t, tt.authModule, authModule)
	}

	t.Run("no separator", func(t *testing.T) {
		_, _, ok := DecodeName("no-dot-in-this-name")
		require.False(t, ok)
	})
}
