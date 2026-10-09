package v3

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func TestInsecureTokenExchangerIsShared(t *testing.T) {
	first, err := InsecureTokenExchanger()
	require.NoError(t, err)
	second, err := InsecureTokenExchanger()
	require.NoError(t, err)
	require.Same(t, first, second, "one signing key is shared")
}

func TestInsecureExchangerCarriesTheCaller(t *testing.T) {
	exchanger, err := newInsecureExchanger()
	require.NoError(t, err)
	// Plugins that skip authentication parse tokens without verifying them.
	unverified := authnlib.NewAccessTokenAuthenticator(authnlib.NewUnsafeAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{"example-app"}}))
	authenticate := func(token string) (types.AuthInfo, error) {
		return unverified.Authenticate(context.Background(), authnlib.NewGRPCTokenProvider(metadata.Pairs("x-access-token", token)))
	}
	exchange := func(subject string) string {
		rsp, err := exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: subject})
		require.NoError(t, err)
		return rsp.Token
	}

	idToken := signTestToken(t, authnlib.TokenTypeID, "user:u1", authnlib.IDTokenClaims{Identifier: "u1", Type: types.TypeUser, Namespace: "default", Username: "admin"})
	first := exchange(idToken)
	info, err := authenticate(first)
	require.NoError(t, err)
	require.Equal(t, "user:u1", info.GetUID())
	require.Equal(t, "admin", info.GetUsername())
	require.Equal(t, "default", info.GetNamespace())
	require.Equal(t, []string{"example-app"}, info.GetAudience())

	// An onward exchange keeps the caller, as a real exchange does.
	info, err = authenticate(exchange(first))
	require.NoError(t, err)
	require.Equal(t, "user:u1", info.GetUID())

	// Without a subject token, as for Grafana's service identity, it is Grafana.
	info, err = authenticate(exchange(""))
	require.NoError(t, err)
	require.Equal(t, "access-policy:grafana", info.GetSubject())

	// No verifier trusts the signing key.
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	verifier := authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{}, staticKey{&jose.JSONWebKey{Key: &key.PublicKey, KeyID: "insecure-local"}})
	_, err = verifier.Verify(context.Background(), first)
	require.Error(t, err)

	_, err = exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Audiences: []string{"example-app"}})
	require.ErrorContains(t, err, "namespace and audiences are required")
	_, err = exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: "not-a-token"})
	require.Error(t, err)
}

type staticKey struct{ key *jose.JSONWebKey }

func (k staticKey) Get(context.Context, string) (*jose.JSONWebKey, error) { return k.key, nil }

func signTestToken(t *testing.T, typ, subject string, claims any) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType(jose.ContentType(typ)).WithHeader("kid", "test"))
	require.NoError(t, err)
	token, err := jwt.Signed(signer).Claims(jwt.Claims{Subject: subject, Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}).Claims(claims).Serialize()
	require.NoError(t, err)
	return token
}
