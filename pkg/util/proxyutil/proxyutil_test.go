package proxyutil

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
)

// fakeIDTokenDeriver is a stub authnlib.IDTokenDeriver for tests.
type fakeIDTokenDeriver struct {
	calls int
	err   error
}

func (f *fakeIDTokenDeriver) DeriveIDToken(ctx context.Context, subjectToken, namespace string) (*authnlib.DeriveIDTokenResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	return &authnlib.DeriveIDTokenResponse{Token: "derived-" + subjectToken}, nil
}

func TestPrepareProxyRequest(t *testing.T) {
	t.Run("Prepare proxy request should clear Origin and Referer headers", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("Origin", "https://host.com")
		req.Header.Set("Referer", "https://host.com/dashboard")

		PrepareProxyRequest(req)
		require.NotContains(t, req.Header, "Origin")
		require.NotContains(t, req.Header, "Referer")
	})

	t.Run("Prepare proxy request should set X-Grafana-Referer header", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("Referer", "https://host.com/dashboard")

		PrepareProxyRequest(req)
		require.Contains(t, req.Header, "X-Grafana-Referer")
		require.Equal(t, "https://host.com/dashboard", req.Header.Get("X-Grafana-Referer"))
	})

	t.Run("Prepare proxy request X-Grafana-Referer handles multiline", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("Referer", "https://www.google.ch\r\nOtherHeader:https://www.somethingelse.com")

		PrepareProxyRequest(req)
		require.Contains(t, req.Header, "X-Grafana-Referer")
		require.NotContains(t, req.Header, "OtherHeader")
		require.Equal(t, "https://www.google.ch\r\nOtherHeader:https://www.somethingelse.com", req.Header.Get("X-Grafana-Referer"))
	})

	t.Run("Prepare proxy request should clear X-Forwarded headers", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("X-Forwarded-Host", "host")
		req.Header.Set("X-Forwarded-Port", "123")
		req.Header.Set("X-Forwarded-Proto", "http1")

		PrepareProxyRequest(req)
		require.NotContains(t, req.Header, "X-Forwarded-Host")
		require.NotContains(t, req.Header, "X-Forwarded-Port")
		require.NotContains(t, req.Header, "X-Forwarded-Proto")
	})

	t.Run("Prepare proxy request should set X-Forwarded-For", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		require.NoError(t, err)

		PrepareProxyRequest(req)
		require.Contains(t, req.Header, "X-Forwarded-For")
		require.Equal(t, "127.0.0.1", req.Header.Get("X-Forwarded-For"))
	})

	t.Run("Prepare proxy request should append client ip at the end of X-Forwarded-For", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		req.RemoteAddr = "127.0.0.1:1234"
		req.Header.Set("X-Forwarded-For", "192.168.0.1")
		require.NoError(t, err)

		PrepareProxyRequest(req)
		require.Contains(t, req.Header, "X-Forwarded-For")
		require.Equal(t, "192.168.0.1, 127.0.0.1", req.Header.Get("X-Forwarded-For"))
	})
}

func TestClearCookieHeader(t *testing.T) {
	t.Run("Clear cookie header should clear Cookie header", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie"})

		ClearCookieHeader(req, nil, nil)
		require.NotContains(t, req.Header, "Cookie")
	})

	t.Run("Clear cookie header with cookies to keep should clear Cookie header and keep cookies", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "cookie2"})
		req.AddCookie(&http.Cookie{Name: "cookie3"})

		ClearCookieHeader(req, []string{"cookie1", "cookie3"}, nil)
		require.Contains(t, req.Header, "Cookie")
		require.Equal(t, "cookie1=; cookie3=", req.Header.Get("Cookie"))
	})

	t.Run("Clear cookie header with cookies to keep and skip should clear Cookie header and keep cookies", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "cookie2"})
		req.AddCookie(&http.Cookie{Name: "cookie3"})

		ClearCookieHeader(req, []string{"cookie1", "cookie3"}, []string{"cookie3"})
		require.Contains(t, req.Header, "Cookie")
		require.Equal(t, "cookie1=", req.Header.Get("Cookie"))
	})

	t.Run("Clear cookie header with cookies to keep should clear Cookie header and keep cookies with optional matching", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "cookie3"})

		ClearCookieHeader(req, []string{"cookie[]"}, nil)
		require.Contains(t, req.Header, "Cookie")
		require.Equal(t, "cookie1=; cookie3=", req.Header.Get("Cookie"))
	})

	t.Run("Clear cookie header with cookies to keep should clear Cookie header and keep cookies with matching pattern but with empty matching option", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "cookie2"})
		req.AddCookie(&http.Cookie{Name: "cookie3"})

		ClearCookieHeader(req, []string{"cookie[]"}, []string{"cookie2"})
		require.Contains(t, req.Header, "Cookie")
		require.Equal(t, "cookie1=; cookie3=", req.Header.Get("Cookie"))
	})

	t.Run("Clear cookie header with cookie match pattern to keep and skip should clear Cookie header and keep cookies", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cook1"})
		req.AddCookie(&http.Cookie{Name: "special23"})
		req.AddCookie(&http.Cookie{Name: "special_1asd987dsf9a"})
		req.AddCookie(&http.Cookie{Name: "c00k1e"})

		ClearCookieHeader(req, []string{"special_[]"}, nil)
		require.Contains(t, req.Header, "Cookie")
		require.Equal(t, "special_1asd987dsf9a=", req.Header.Get("Cookie"))
	})

	t.Run("Clear cookie header with cookie should not match BAD pattern and return no cookies", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "special23"})

		ClearCookieHeader(req, []string{"[]cookie"}, nil)
		require.NotContains(t, req.Header, "Cookie")
	})

	t.Run("Clear cookie header with cookie should match all cookies when keepCookies is *", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "special23"})

		ClearCookieHeader(req, []string{"[]"}, nil)
		require.Equal(t, "cookie1=; special23=", req.Header.Get("Cookie"))
	})
}

func TestApplyUserHeader(t *testing.T) {
	t.Run("Should not apply user header when not enabled, should remove the existing", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("X-Grafana-User", "admin")

		ApplyUserHeader(false, req, &user.SignedInUser{Login: "admin", UserID: 1, FallbackType: claims.TypeUser})
		require.NotContains(t, req.Header, "X-Grafana-User")
	})

	t.Run("Should not apply user header when user is nil, should remove the existing", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("X-Grafana-User", "admin")

		ApplyUserHeader(false, req, nil)
		require.NotContains(t, req.Header, "X-Grafana-User")
	})

	t.Run("Should not apply user header for anonomous user", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		ApplyUserHeader(true, req, &user.SignedInUser{IsAnonymous: true, FallbackType: claims.TypeAnonymous})
		require.NotContains(t, req.Header, "X-Grafana-User")
	})

	login := "identity"
	testCases := []struct {
		name string
		user identity.Requester
	}{
		{name: "user", user: &identity.StaticRequester{Login: login, UserID: 5, Type: claims.TypeUser}},
		{name: "service account", user: &identity.StaticRequester{Login: login, UserID: 77, Type: claims.TypeServiceAccount}},
	}

	for _, tc := range testCases {
		t.Run("Should apply user header for "+tc.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/", nil)
			require.NoError(t, err)

			ApplyUserHeader(true, req, tc.user)
			require.Equal(t, login, req.Header.Get("X-Grafana-User"))
		})
	}
}

func TestApplyForwardIDHeader(t *testing.T) {
	t.Run("Should set the header from GetIDToken when present", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		ApplyForwardIDHeader(context.Background(), req, &identity.StaticRequester{IDToken: "signed-id-token"}, nil)
		require.Equal(t, "signed-id-token", req.Header.Get(IDHeaderName))
	})

	t.Run("Should derive and set the header when there is no id token but an access token", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		deriver := &fakeIDTokenDeriver{}

		ApplyForwardIDHeader(context.Background(), req, &identity.StaticRequester{
			Type: claims.TypeUser, AccessToken: "obo-access-token",
		}, deriver)
		require.Equal(t, "derived-obo-access-token", req.Header.Get(IDHeaderName))
		require.Equal(t, 1, deriver.calls)
	})

	t.Run("Should remove a pre-existing header when derivation fails, rather than leave it unverified", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set(IDHeaderName, "attacker-supplied-or-stale")
		deriver := &fakeIDTokenDeriver{err: errors.New("auth-api unreachable")}

		ApplyForwardIDHeader(context.Background(), req, &identity.StaticRequester{
			Type: claims.TypeUser, AccessToken: "obo-access-token",
		}, deriver)
		require.NotContains(t, req.Header, IDHeaderName)
	})

	t.Run("Should remove a pre-existing header when there is no requester", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set(IDHeaderName, "attacker-supplied-or-stale")

		ApplyForwardIDHeader(context.Background(), req, nil, &fakeIDTokenDeriver{})
		require.NotContains(t, req.Header, IDHeaderName)
	})

	t.Run("Should remove a pre-existing header when there is nothing to derive from", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set(IDHeaderName, "attacker-supplied-or-stale")

		ApplyForwardIDHeader(context.Background(), req, &identity.StaticRequester{Type: claims.TypeUser}, &fakeIDTokenDeriver{})
		require.NotContains(t, req.Header, IDHeaderName)
	})
}
