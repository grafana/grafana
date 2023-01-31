package proxyutil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/user"
)

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
}

func TestApplyUserHeader(t *testing.T) {
	t.Run("Should not apply user header when not enabled, should remove the existing", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Set("X-Grafana-User", "admin")

		ApplyUserHeader(false, req, &user.SignedInUser{Login: "admin"})
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

		ApplyUserHeader(true, req, &user.SignedInUser{IsAnonymous: true})
		require.NotContains(t, req.Header, "X-Grafana-User")
	})

	t.Run("Should apply user header for non-anonomous user", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)

		ApplyUserHeader(true, req, &user.SignedInUser{Login: "admin"})
		require.Equal(t, "admin", req.Header.Get("X-Grafana-User"))
	})
}
