package source

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type fakeSecure struct{ secret, token common.RawSecureValue }

func (f fakeSecure) PrivateKey(context.Context) (common.RawSecureValue, error) { return "", nil }
func (f fakeSecure) ClientSecret(context.Context) (common.RawSecureValue, error) {
	return f.secret, nil
}
func (f fakeSecure) Token(context.Context) (common.RawSecureValue, error) { return f.token, nil }

func newConn(t *testing.T, tokenURL string, token common.RawSecureValue) connection.Connection {
	t.Helper()
	extra := Extra(func(*provisioning.Connection) connection.SecureValues {
		return fakeSecure{secret: "client-secret", token: token}
	}, true)
	conn, err := extra.Build(context.Background(), &provisioning.Connection{
		ObjectMeta: metav1.ObjectMeta{Name: "remote"},
		Spec: provisioning.ConnectionSpec{
			Type:   provisioning.SourceConnectionType,
			OAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "client-id"},
			Source: &provisioning.SourceConnectionConfig{TokenURL: tokenURL, Audience: "source.example.com", Scopes: []string{"read"}},
		},
	})
	require.NoError(t, err)
	return conn
}

func storedToken(t *testing.T, access string, expiry time.Time) common.RawSecureValue {
	t.Helper()
	raw, err := json.Marshal(&oauth2.Token{AccessToken: access, Expiry: expiry}) //nolint:gosec // synthetic test token
	require.NoError(t, err)
	return common.RawSecureValue(raw)
}

func TestGenerateConnectionToken(t *testing.T) {
	t.Run("runs the client-credentials grant with the configured audience and scopes", func(t *testing.T) {
		var got map[string][]string
		var user, pass string
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.NoError(t, r.ParseForm())
			got = r.PostForm
			user, pass, _ = r.BasicAuth()
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"minted-1","token_type":"Bearer","expires_in":3600}`))
		}))
		t.Cleanup(ts.Close)

		generated, err := newConn(t, ts.URL, "").(connection.TokenConnection).GenerateConnectionToken(context.Background())
		require.NoError(t, err)

		assert.Equal(t, []string{"client_credentials"}, got["grant_type"])
		assert.Equal(t, []string{"source.example.com"}, got["audience"])
		assert.Equal(t, []string{"read"}, got["scope"])
		assert.Equal(t, "client-id", user)
		assert.Equal(t, "client-secret", pass)
		assert.WithinDuration(t, time.Now().Add(time.Hour), generated.ExpiresAt, time.Minute)

		var stored oauth2.Token
		require.NoError(t, json.Unmarshal([]byte(generated.Token), &stored))
		assert.Equal(t, "minted-1", stored.AccessToken)
	})

	t.Run("rejected credentials are an authentication error the user has to fix", func(t *testing.T) {
		for _, status := range []int{http.StatusUnauthorized, http.StatusForbidden} {
			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(status)
				_, _ = w.Write([]byte(`{"error":"invalid_client"}`))
			}))
			t.Cleanup(ts.Close)

			_, err := newConn(t, ts.URL, "").(connection.TokenConnection).GenerateConnectionToken(context.Background())
			assert.ErrorIs(t, err, connection.ErrAuthentication, "status %d", status)
		}
	})

	t.Run("a failing endpoint is transient, not an authentication error", func(t *testing.T) {
		ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		t.Cleanup(ts.Close)

		_, err := newConn(t, ts.URL, "").(connection.TokenConnection).GenerateConnectionToken(context.Background())
		require.Error(t, err)
		assert.NotErrorIs(t, err, connection.ErrAuthentication)
	})
}

func TestValidateToken(t *testing.T) {
	expiry := time.Now().Add(time.Hour).Truncate(time.Second)

	t.Run("reports when the stored token expires", func(t *testing.T) {
		got, err := newConn(t, "https://idp", storedToken(t, "a", expiry)).(connection.TokenConnection).ValidateToken()
		require.NoError(t, err)
		assert.True(t, expiry.Equal(got))
	})
	t.Run("a token that never expires has a zero expiry", func(t *testing.T) {
		got, err := newConn(t, "https://idp", storedToken(t, "a", time.Time{})).(connection.TokenConnection).ValidateToken()
		require.NoError(t, err)
		assert.True(t, got.IsZero())
	})
	t.Run("no token", func(t *testing.T) {
		_, err := newConn(t, "https://idp", "").(connection.TokenConnection).ValidateToken()
		assert.Error(t, err)
	})
	t.Run("a payload without an access token", func(t *testing.T) {
		_, err := newConn(t, "https://idp", storedToken(t, "", expiry)).(connection.TokenConnection).ValidateToken()
		assert.Error(t, err)
	})
	t.Run("garbage", func(t *testing.T) {
		_, err := newConn(t, "https://idp", "not json").(connection.TokenConnection).ValidateToken()
		assert.Error(t, err)
	})
}

func TestGenerateRepositoryToken(t *testing.T) {
	repo := &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.SourceRepositoryType}}
	expiry := time.Now().Add(time.Hour)

	t.Run("hands a source repository the access token", func(t *testing.T) {
		got, err := newConn(t, "https://idp", storedToken(t, "minted-1", expiry)).GenerateRepositoryToken(context.Background(), repo)
		require.NoError(t, err)
		assert.Equal(t, common.RawSecureValue("minted-1"), got.Token, "the repository gets the bare access token, not the stored payload")
		assert.WithinDuration(t, expiry, got.ExpiresAt, time.Second)
	})
	t.Run("not for git repositories", func(t *testing.T) {
		_, err := newConn(t, "https://idp", storedToken(t, "a", expiry)).GenerateRepositoryToken(context.Background(),
			&provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitRepositoryType}})
		assert.Error(t, err)
	})
	t.Run("an expired token is an authentication error", func(t *testing.T) {
		_, err := newConn(t, "https://idp", storedToken(t, "a", time.Now().Add(-time.Minute))).GenerateRepositoryToken(context.Background(), repo)
		assert.ErrorIs(t, err, connection.ErrAuthentication)
	})
	t.Run("no token yet", func(t *testing.T) {
		_, err := newConn(t, "https://idp", "").GenerateRepositoryToken(context.Background(), repo)
		assert.ErrorIs(t, err, connection.ErrAuthentication)
	})
}

func TestTest(t *testing.T) {
	ok, err := newConn(t, "https://idp", storedToken(t, "a", time.Now().Add(time.Hour))).Test(context.Background())
	require.NoError(t, err)
	assert.True(t, ok.Success)

	for name, token := range map[string]common.RawSecureValue{
		"no token yet": "",
		"expired":      storedToken(t, "a", time.Now().Add(-time.Minute)),
	} {
		t.Run(name, func(t *testing.T) {
			res, err := newConn(t, "https://idp", token).Test(context.Background())
			require.NoError(t, err)
			assert.False(t, res.Success)
			require.Len(t, res.Errors, 1)
			assert.Equal(t, "secure.token", res.Errors[0].Field)
		})
	}
}

func TestValidate(t *testing.T) {
	valid := func(mutate func(*provisioning.Connection)) *provisioning.Connection {
		conn := &provisioning.Connection{
			Spec: provisioning.ConnectionSpec{
				Type:   provisioning.SourceConnectionType,
				OAuth:  &provisioning.ConnectionOAuthConfig{ClientID: "id"},
				Source: &provisioning.SourceConnectionConfig{TokenURL: "https://idp.example.com/oauth/token"},
			},
			Secure: provisioning.ConnectionSecure{ClientSecret: common.InlineSecureValue{Create: "secret"}},
		}
		if mutate != nil {
			mutate(conn)
		}
		return conn
	}

	tests := []struct {
		name          string
		conn          *provisioning.Connection
		allowInsecure bool
		wantFields    []string
	}{
		{name: "valid", conn: valid(nil)},
		{name: "no source config", conn: valid(func(c *provisioning.Connection) { c.Spec.Source = nil }), wantFields: []string{"spec.source"}},
		{name: "no token url", conn: valid(func(c *provisioning.Connection) { c.Spec.Source.TokenURL = "" }), wantFields: []string{"spec.source.tokenURL"}},
		{name: "http token url", conn: valid(func(c *provisioning.Connection) { c.Spec.Source.TokenURL = "http://idp.example.com/t" }), wantFields: []string{"spec.source.tokenURL"}},
		{name: "http token url in dev", conn: valid(func(c *provisioning.Connection) { c.Spec.Source.TokenURL = "http://127.0.0.1/t" }), allowInsecure: true},
		{name: "credentials in the url", conn: valid(func(c *provisioning.Connection) { c.Spec.Source.TokenURL = "https://u:p@idp.example.com/t" }), wantFields: []string{"spec.source.tokenURL"}},
		{name: "no client id", conn: valid(func(c *provisioning.Connection) { c.Spec.OAuth = nil }), wantFields: []string{"spec.oauth.clientID"}},
		{name: "no client secret", conn: valid(func(c *provisioning.Connection) { c.Secure.ClientSecret = common.InlineSecureValue{} }), wantFields: []string{"secure.clientSecret"}},
		{name: "a private key", conn: valid(func(c *provisioning.Connection) { c.Secure.PrivateKey = common.InlineSecureValue{Create: "k"} }), wantFields: []string{"secure.privateKey"}},
		{name: "other connection types are not this extra's business", conn: valid(func(c *provisioning.Connection) { c.Spec.Type = provisioning.GithubConnectionType; c.Spec.Source = nil })},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errs := Extra(nil, tt.allowInsecure).Validate(context.Background(), tt.conn)

			got := make([]string, 0, len(errs))
			for _, err := range errs {
				got = append(got, err.Field)
			}
			assert.ElementsMatch(t, tt.wantFields, got, errs.ToAggregate())
		})
	}
}
