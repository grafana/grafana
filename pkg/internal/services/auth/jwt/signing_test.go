package jwt

import (
	"testing"

	"github.com/stretchr/testify/require"
	jose "gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

type noneSigner struct{}

func sign(t *testing.T, key interface{}, claims interface{}) string {
	t.Helper()

	sig, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.PS512, Key: key}, (&jose.SignerOptions{}).WithType("JWT"))
	require.NoError(t, err)
	token, err := jwt.Signed(sig).Claims(claims).CompactSerialize()
	require.NoError(t, err)
	return token
}

func (s noneSigner) Public() *jose.JSONWebKey {
	return nil
}

func (s noneSigner) Algs() []jose.SignatureAlgorithm {
	return []jose.SignatureAlgorithm{"none"}
}

func (s noneSigner) SignPayload(payload []byte, alg jose.SignatureAlgorithm) ([]byte, error) {
	return nil, nil
}

func signNone(t *testing.T, claims interface{}) string {
	t.Helper()

	sig, err := jose.NewSigner(jose.SigningKey{Algorithm: "none", Key: noneSigner{}}, (&jose.SignerOptions{}).WithType("JWT"))
	require.NoError(t, err)
	token, err := jwt.Signed(sig).Claims(claims).CompactSerialize()
	require.NoError(t, err)
	return token
}
