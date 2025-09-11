package identity_test

import (
	"crypto/ecdsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
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

var testKey = decodePrivateKey([]byte(`
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEID6lXWsmcv/UWn9SptjOThsy88cifgGIBj2Lu0M9I8tQoAoGCCqGSM49
AwEHoUQDQgAEsf6eNnNMNhl+q7jXsbdUf3ADPh248uoFUSSV9oBzgptyokHCjJz6
n6PKDm2W7i3S2+dAs5M5f3s7d8KiLjGZdQ==
-----END EC PRIVATE KEY-----
`))

func decodePrivateKey(data []byte) *ecdsa.PrivateKey {
	block, _ := pem.Decode(data)
	if block == nil {
		panic("should include PEM block")
	}

	privateKey, err := x509.ParseECPrivateKey(block.Bytes)
	if err != nil {
		panic(fmt.Sprintf("should be able to parse ec private key: %v", err))

	}
	if privateKey.Curve.Params().Name != "P-256" {
		panic("should be valid private key")
	}

	return privateKey
}

func createToken(t *testing.T, exp *time.Time) string {
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: testKey}, nil)
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

	token, err := jwt.Signed(signer).Claims(claims).Serialize()
	require.NoError(t, err)
	return token
}
