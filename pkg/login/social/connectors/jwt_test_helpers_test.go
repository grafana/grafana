package connectors

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"testing"

	jose "github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
)

// createTestRSAKey generates an RSA key pair for JWT tests.
func createTestRSAKey(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	return key, "test-key-id"
}

// createJWKSResponse builds a JSON Web Key Set response for the given key (used by mock JWKS servers).
func createJWKSResponse(t *testing.T, key *rsa.PrivateKey, keyID string) []byte {
	t.Helper()
	jwk := jose.JSONWebKey{
		KeyID:     keyID,
		Key:       key.Public(),
		Use:       "sig",
		Algorithm: string(jose.RS256),
	}
	jwks := jose.JSONWebKeySet{
		Keys: []jose.JSONWebKey{jwk},
	}
	jsonData, err := json.Marshal(jwks)
	require.NoError(t, err)
	return jsonData
}

// signJWT signs claims with the given RSA key and returns a serialized JWT.
func signJWT(t *testing.T, key *rsa.PrivateKey, keyID string, claims map[string]any) string {
	t.Helper()
	sig, err := jose.NewSigner(
		jose.SigningKey{Algorithm: jose.RS256, Key: key},
		(&jose.SignerOptions{}).WithHeader("kid", keyID).WithType("JWT"),
	)
	require.NoError(t, err)
	token, err := jwt.Signed(sig).Claims(claims).Serialize()
	require.NoError(t, err)
	return token
}
