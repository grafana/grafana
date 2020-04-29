package proxyutil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPrepareProxyRequest(t *testing.T) {
	t.Run("Prepare proxy request should clear X-Forwarded headers", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.Header.Add("X-Forwarded-Host", "host")
		req.Header.Add("X-Forwarded-Port", "123")
		req.Header.Add("X-Forwarded-Proto", "http1")

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
		req.Header.Add("X-Forwarded-For", "192.168.0.1")
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

		ClearCookieHeader(req, nil)
		require.NotContains(t, req.Header, "Cookie")
	})

	t.Run("Clear cookie header with cookies to keep should clear Cookie header and keep cookies", func(t *testing.T) {
		req, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		req.AddCookie(&http.Cookie{Name: "cookie1"})
		req.AddCookie(&http.Cookie{Name: "cookie2"})
		req.AddCookie(&http.Cookie{Name: "cookie3"})

		ClearCookieHeader(req, []string{"cookie1", "cookie3"})
		require.Contains(t, req.Header, "Cookie")
		require.Equal(t, "cookie1=; cookie3=", req.Header.Get("Cookie"))
	})
}
