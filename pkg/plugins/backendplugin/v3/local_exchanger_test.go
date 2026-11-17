package v3

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana-app-sdk/plugin"
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

func TestRealSigningKeysConfigured(t *testing.T) {
	require.False(t, RealSigningKeysConfigured(""))
	require.True(t, RealSigningKeysConfigured("https://auth.example.com/v1/keys"))
	for _, key := range []string{plugin.EnvVarGrafanaJWKS, plugin.EnvVarGrafanaJWKSURL} {
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
// started with that JWKS in GF_JWKS does.
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
	return signTestTokenExpiring(t, typ, subject, claims, time.Now().Add(time.Hour))
}

func signTestTokenExpiring(t *testing.T, typ, subject string, claims any, expiry time.Time) string {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType(jose.ContentType(typ)).WithHeader("kid", "test"))
	require.NoError(t, err)
	token, err := jwt.Signed(signer).Claims(jwt.Claims{Subject: subject, Expiry: jwt.NewNumericDate(expiry)}).Claims(claims).Serialize()
	require.NoError(t, err)
	return token
}

// An exchanged token is reused for the exact same request, for at most half
// its lifetime and never past the subject token's expiry. Any other request
// gets its own.
func TestLocalExchangerReusesTokens(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		exchanger, err := newLocalExchanger()
		require.NoError(t, err)
		exchange := func(req authnlib.TokenExchangeRequest) string {
			rsp, err := exchanger.Exchange(context.Background(), req)
			require.NoError(t, err)
			return rsp.Token
		}
		user := signTestToken(t, authnlib.TokenTypeID, "user:u1", authnlib.IDTokenClaims{Identifier: "u1", Type: types.TypeUser, Namespace: "default"})
		other := signTestToken(t, authnlib.TokenTypeID, "user:u2", authnlib.IDTokenClaims{Identifier: "u2", Type: types.TypeUser, Namespace: "default"})
		req := authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app", "other-app"}, SubjectToken: user}

		first := exchange(req)
		require.Equal(t, first, exchange(req), "the same request reuses its token")
		for name, changed := range map[string]authnlib.TokenExchangeRequest{
			"another caller":           {Namespace: "default", Audiences: req.Audiences, SubjectToken: other},
			"no caller":                {Namespace: "default", Audiences: req.Audiences},
			"another namespace":        {Namespace: "org-2", Audiences: req.Audiences, SubjectToken: user},
			"audiences in other order": {Namespace: "default", Audiences: []string{"other-app", "example-app"}, SubjectToken: user},
		} {
			require.NotEqual(t, first, exchange(changed), name)
		}
		limits := 60
		for name, uncached := range map[string]authnlib.TokenExchangeRequest{
			"expires in":             {Namespace: "default", Audiences: req.Audiences, SubjectToken: user, ExpiresIn: &limits},
			"restricted permissions": {Namespace: "default", Audiences: req.Audiences, SubjectToken: user, RestrictedDelegatedPermissions: []string{"a:read"}},
		} {
			require.NotEqual(t, exchange(uncached), exchange(uncached), name+" is signed afresh")
		}

		time.Sleep(localTokenReuse - time.Second)
		require.Equal(t, first, exchange(req))
		time.Sleep(time.Second)
		require.NotEqual(t, first, exchange(req), "a token is reused for at most half its lifetime")

		// Never past the subject token's expiry.
		short := signTestTokenExpiring(t, authnlib.TokenTypeID, "user:u3", authnlib.IDTokenClaims{Identifier: "u3", Type: types.TypeUser, Namespace: "default"}, time.Now().Add(time.Minute))
		shortReq := authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: short}
		token := exchange(shortReq)
		time.Sleep(time.Minute - time.Second)
		require.Equal(t, token, exchange(shortReq))
		time.Sleep(time.Second)
		require.NotEqual(t, token, exchange(shortReq), "a token is not reused past its subject token's expiry")
	})
}

func TestLocalTokenCacheIsBounded(t *testing.T) {
	cache := localTokenCache{tokens: map[[sha256.Size]byte]cachedLocalToken{}}
	now := time.Now()
	for i := range localTokenCacheSize + 10 {
		key := localTokenKey(authnlib.TokenExchangeRequest{Namespace: fmt.Sprint(i), Audiences: []string{"a"}})
		cache.add(key, cachedLocalToken{token: "t", reuseUntil: now.Add(time.Minute)}, now)
		require.LessOrEqual(t, len(cache.tokens), localTokenCacheSize)
	}
}

// BenchmarkLocalExchanger measures an exchange for a plugin call: reusing the
// token of an earlier, identical request, and signing a new one.
func BenchmarkLocalExchanger(b *testing.B) {
	exchanger, err := newLocalExchanger()
	require.NoError(b, err)
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(b, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType(jose.ContentType(authnlib.TokenTypeID)).WithHeader("kid", "test"))
	require.NoError(b, err)
	user, err := jwt.Signed(signer).Claims(jwt.Claims{Subject: "user:u1", Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}).
		Claims(authnlib.IDTokenClaims{Identifier: "u1", Type: types.TypeUser, Namespace: "default"}).Serialize()
	require.NoError(b, err)
	req := authnlib.TokenExchangeRequest{Namespace: "default", Audiences: []string{"example-app"}, SubjectToken: user}
	b.Run("reused", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			if _, err := exchanger.Exchange(context.Background(), req); err != nil {
				b.Fatal(err)
			}
		}
	})
	b.Run("signed", func(b *testing.B) {
		limits := 60
		fresh := req
		fresh.ExpiresIn = &limits // not cached
		b.ReportAllocs()
		for b.Loop() {
			if _, err := exchanger.Exchange(context.Background(), fresh); err != nil {
				b.Fatal(err)
			}
		}
	})
}
