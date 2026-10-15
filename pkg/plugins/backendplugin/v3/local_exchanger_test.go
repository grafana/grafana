package v3

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"encoding/json"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	appplugin "github.com/grafana/grafana-app-sdk/plugin"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
)

func TestLocalTokenExchangerIsShared(t *testing.T) {
	first, err := LocalTokenExchanger()
	require.NoError(t, err)
	second, err := LocalTokenExchanger()
	require.NoError(t, err)
	require.Same(t, first, second, "one signing key is shared")

	jwks, err := LocalSigningKeys()
	require.NoError(t, err)
	rsp, err := first.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}})
	require.NoError(t, err)
	_, err = jwksVerifier(t, jwks, "example-app").Verify(context.Background(), rsp.Token)
	require.NoError(t, err, "the shared signing keys verify the shared exchanger's tokens")
}

func TestEnvVarSigningKeysMatchAppSDK(t *testing.T) {
	require.Equal(t, appplugin.EnvVarGrafanaJWKS, EnvVarSigningKeys)
	require.Equal(t, appplugin.EnvVarGrafanaJWKSURL, EnvVarSigningKeysURL)
}

func TestRealSigningKeysConfigured(t *testing.T) {
	require.False(t, RealSigningKeysConfigured(""))
	require.True(t, RealSigningKeysConfigured("https://auth.example.com/v1/keys"))
	for _, key := range []string{EnvVarSigningKeys, EnvVarSigningKeysURL} {
		t.Run(key, func(t *testing.T) {
			t.Setenv(key, "from-host")
			require.True(t, RealSigningKeysConfigured(""))
		})
	}
}

func TestLocalSigningKeys(t *testing.T) {
	exchanger, err := newLocalExchanger()
	require.NoError(t, err)

	var set jose.JSONWebKeySet
	require.NoError(t, json.Unmarshal([]byte(exchanger.jwks), &set))
	require.Len(t, set.Keys, 1)
	key := set.Keys[0]
	require.True(t, key.IsPublic(), "plugins must not receive the private key")
	require.True(t, key.Valid())
	require.Equal(t, LocalKeyID, key.KeyID)
	require.Equal(t, "sig", key.Use)

	rsp, err := exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}})
	require.NoError(t, err)
	_, err = jwksVerifier(t, exchanger.jwks, "other-app").Verify(context.Background(), rsp.Token)
	require.Error(t, err, "tokens are bound to their audience")

	// Another Grafana process has another key.
	other, err := newLocalExchanger()
	require.NoError(t, err)
	_, err = jwksVerifier(t, other.jwks, "example-app").Verify(context.Background(), rsp.Token)
	require.Error(t, err)
}

func TestLocalExchangerCarriesTheCaller(t *testing.T) {
	exchanger, err := newLocalExchanger()
	require.NoError(t, err)
	verified := authnlib.NewAccessTokenAuthenticator(jwksVerifier(t, exchanger.jwks, "example-app"))
	authenticate := func(token string) (types.AuthInfo, error) {
		return verified.Authenticate(context.Background(), authnlib.NewGRPCTokenProvider(metadata.Pairs("x-access-token", token)))
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

	_, err = exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Audiences: []string{"example-app"}})
	require.ErrorContains(t, err, "namespace and audiences are required")
	_, err = exchanger.Exchange(context.Background(), authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: "not-a-token"})
	require.Error(t, err)
}

// jwksVerifier verifies access tokens with the keys of a JWKS, as a plugin
// started with that JWKS in GRAFANA_JWKS does.
func jwksVerifier(t *testing.T, jwks string, audience string) *authnlib.AccessTokenVerifier {
	t.Helper()
	var set jose.JSONWebKeySet
	require.NoError(t, json.Unmarshal([]byte(jwks), &set))
	return authnlib.NewAccessTokenVerifier(authnlib.VerifierConfig{AllowedAudiences: []string{audience}}, jwksKeys(set))
}

type jwksKeys jose.JSONWebKeySet

func (k jwksKeys) Get(_ context.Context, keyID string) (*jose.JSONWebKey, error) {
	set := jose.JSONWebKeySet(k)
	if keys := set.Key(keyID); len(keys) > 0 {
		return &keys[0], nil
	}
	return nil, authnlib.ErrInvalidSigningKey
}

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
