package proxyutil

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
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

func TestApplyteamHTTPHeaders(t *testing.T) {
	testCases := []struct {
		desc      string
		jsonData  any
		userTeams []int64
		want      map[string]string
	}{
		{
			desc: "Should apply team headers for users teams",
			jsonData: map[string]interface{}{
				"1": []map[string]interface{}{
					{
						"header": "X-Team-Header",
						"value":  "1",
					},
				},
				"2": []map[string]interface{}{
					{
						"header": "X-Prom-Label-Policy",
						"value":  "2",
					},
				},
				// user is not part of this team
				"3": []map[string]interface{}{
					{
						"header": "X-Custom-Label-Policy",
						"value":  "3",
					},
				},
			},
			userTeams: []int64{1, 2},
			want: map[string]string{
				"X-Team-Header":       "1",
				"X-Prom-Label-Policy": "2",
			},
		},
		{
			desc: "Should be able to parse header values with commas",
			jsonData: map[string]interface{}{
				"101": []map[string]interface{}{
					{
						"header": "X-Prom-Label-Policy",
						"value":  `1234:{ foo="bar", bar="baz" }`,
					},
				},
			},
			userTeams: []int64{101},
			want: map[string]string{
				"X-Prom-Label-Policy": "1234:%7B%20foo=%22bar%22%2C%20bar=%22baz%22%20%7D",
			},
		}, {
			desc: "Should be able to handle multiple header values",
			jsonData: map[string]interface{}{
				"101": []map[string]interface{}{
					{
						"header": "X-Prom-Label-Policy",
						"value":  `1234:{ foo="bar" }`,
					},
					{
						"header": "X-Prom-Label-Policy",
						"value":  `1234:{ bar="baz" }`,
					},
				},
			},
			userTeams: []int64{101},
			want: map[string]string{
				"X-Prom-Label-Policy": "1234:%7B%20foo=%22bar%22%20%7D,1234:%7B%20bar=%22baz%22%20%7D",
			},
		},
	}

	for _, testCase := range testCases {
		t.Run("Should apply team headers for users teams", func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/", nil)
			require.NoError(t, err)
			ds := &datasources.DataSource{
				JsonData: simplejson.New(),
			}

			// add team headers
			ds.JsonData.Set("teamHttpHeaders", testCase.jsonData)

			err = ApplyTeamHTTPHeaders(req, ds, testCase.userTeams)
			require.NoError(t, err)
			for header, value := range testCase.want {
				require.Contains(t, req.Header, header)
				require.Equal(t, value, req.Header.Get(header))
			}
		})
	}
}
