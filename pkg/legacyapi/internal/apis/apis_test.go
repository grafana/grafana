package apis

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-jose/go-jose/v4"
	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// signedIDToken returns an ID token with the given claims, signed with a
// throwaway key.
func signedIDToken(t *testing.T, claims authn.IDTokenClaims) string {
	t.Helper()

	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.ES256, Key: key}, (&jose.SignerOptions{}).WithType("jwt"))
	require.NoError(t, err)

	token, err := jwt.Signed(signer).
		Claims(jwt.Claims{Expiry: jwt.NewNumericDate(time.Now().Add(time.Hour))}).
		Claims(claims).
		Serialize()
	require.NoError(t, err)
	return token
}

func TestCredentialsFromRequest(t *testing.T) {
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	req.Header.Set("X-Access-Token", "Bearer access")
	req.Header.Set("X-Grafana-Id", "id")

	assert.Equal(t, Credentials{AccessToken: "access", IDToken: "id"}, CredentialsFromRequest(req))
}

func TestParseIDToken(t *testing.T) {
	token := signedIDToken(t, authn.IDTokenClaims{
		Namespace:  "stacks-1",
		Type:       types.TypeUser,
		Identifier: "u1",
	})

	requester, err := ParseIDToken(t.Context(), token)
	require.NoError(t, err)
	assert.Equal(t, Requester{Namespace: "stacks-1", Type: types.TypeUser, Identifier: "u1"}, requester)

	_, err = ParseIDToken(t.Context(), "not-a-token")
	require.Error(t, err)
}

func TestClientGet(t *testing.T) {
	var got http.Header
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Clone()
		switch r.URL.Path {
		case "/apis/x/ok":
			_, _ = w.Write([]byte(`{"apiVersion":"x/v1","kind":"Thing","metadata":{"name":"ok"}}`))
		case "/apis/x/forbidden":
			w.WriteHeader(http.StatusForbidden)
			_, _ = w.Write([]byte(`{"kind":"Status","message":"nope"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	client := NewClient(srv.URL, srv.Client())

	t.Run("forwards credentials and decodes the object", func(t *testing.T) {
		obj, err := client.Get(t.Context(), "/apis/x/ok", Credentials{AccessToken: "access", IDToken: "id"})
		require.NoError(t, err)
		assert.Equal(t, "ok", obj.GetName())
		assert.Equal(t, "access", got.Get("X-Access-Token"))
		assert.Equal(t, "id", got.Get("X-Grafana-Id"))
		assert.Equal(t, "application/json", got.Get("Accept"))
	})

	t.Run("omits an empty ID token", func(t *testing.T) {
		_, err := client.Get(t.Context(), "/apis/x/ok", Credentials{AccessToken: "service"})
		require.NoError(t, err)
		assert.Empty(t, got.Values("X-Grafana-Id"))
	})

	t.Run("returns the status of a failed request", func(t *testing.T) {
		_, err := client.Get(t.Context(), "/apis/x/forbidden", Credentials{})
		assert.Equal(t, http.StatusForbidden, StatusCode(err))

		_, err = client.Get(t.Context(), "/apis/x/missing", Credentials{})
		assert.Equal(t, http.StatusNotFound, StatusCode(err))
	})
}
