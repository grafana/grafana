package identity_test

import (
	"testing"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestIsIDTokenExpired(t *testing.T) {
	tests := []struct {
		name     string
		token    func(t *testing.T) string
		expected bool
	}{
		{
			name: "should return false when ID token is not set",
			token: func(t *testing.T) string {
				return ""
			},
			expected: false,
		},
		{
			name: "should return false when ID token is not expired",
			token: func(t *testing.T) string {
				expiration := time.Now().Add(time.Hour)
				return createToken(t, &expiration)
			},
			expected: false,
		},
		{
			name: "should return true when ID token is expired",
			token: func(t *testing.T) string {
				expiration := time.Now().Add(-time.Hour)
				return createToken(t, &expiration)
			},
			expected: true,
		},
		{
			name: "should return false when ID token has no expiry claim",
			token: func(t *testing.T) string {
				return createToken(t, nil)
			},
			expected: false,
		},
		{
			name: "should return false when ID token is malformed",
			token: func(t *testing.T) string {
				return "invalid.jwt.token"
			},
			expected: false,
		},
		{
			name: "should handle token that expires exactly now",
			token: func(t *testing.T) string {
				expiration := time.Now().Add(-time.Millisecond)
				return createToken(t, &expiration)
			},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := tt.token(t)
			requester := &identity.StaticRequester{IDToken: token}

			result := identity.IsIDTokenExpired(requester)
			require.Equal(t, tt.expected, result)
		})
	}
}

func createToken(t *testing.T, exp *time.Time) string {
	key := []byte("test-secret-key")
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.HS256, Key: key}, nil)
	require.NoError(t, err)

	claims := struct {
		jwt.Claims
	}{
		Claims: jwt.Claims{
			Subject: "test-user",
		},
	}

	if exp != nil {
		claims.Expiry = jwt.NewNumericDate(*exp)
	}

	token, err := jwt.Signed(signer).Claims(claims).CompactSerialize()
	require.NoError(t, err)
	return token
}
