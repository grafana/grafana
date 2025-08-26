package middleware

import (
	"fmt"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOrgRedirectMiddleware(t *testing.T) {
	testCases := []struct {
		desc        string
		input       string
		expStatus   int
		expLocation string
	}{
		{
			desc:        "when setting a correct org for the user",
			input:       "/?orgId=3",
			expStatus:   302,
			expLocation: "/?orgId=3",
		},
		{
			desc:        "when setting a correct org for the user with an empty path",
			input:       "?orgId=3",
			expStatus:   302,
			expLocation: "/?orgId=3",
		},
		{
			desc:        "when setting a correct org for the user with '&kiosk'",
			input:       "/?orgId=3&kiosk",
			expStatus:   302,
			expLocation: "/?orgId=3&kiosk",
		},
		{
			desc:        "when setting a correct org for the user with '&kiosk=",
			input:       "/?kiosk=&orgId=3",
			expStatus:   302,
			expLocation: "/?orgId=3&kiosk",
		},
		{
			desc:        "when setting a correct org for the user with '&kiosk=tv'",
			input:       "/?kiosk=tv&orgId=3",
			expStatus:   302,
			expLocation: "/?kiosk=tv&orgId=3",
		},
	}

	for _, tc := range testCases {
		middlewareScenario(t, tc.desc, func(t *testing.T, sc *scenarioContext) {
			sc.withIdentity(&authn.Identity{})
			sc.m.Get("/", sc.defaultHandler)
			sc.fakeReq("GET", tc.input).exec()

			require.Equal(t, tc.expStatus, sc.resp.Code)
			require.Equal(t, tc.expLocation, sc.resp.Header().Get("Location"))
		})
	}

	middlewareScenario(t, "when setting an invalid org for user", func(t *testing.T, sc *scenarioContext) {
		sc.withIdentity(&authn.Identity{})
		sc.userService.ExpectedError = fmt.Errorf("")

		sc.m.Get("/", sc.defaultHandler)
		sc.fakeReq("GET", "/?orgId=1").exec()

		require.Equal(t, 404, sc.resp.Code)
	})

	middlewareScenario(t, "when redirecting to an invalid path", func(t *testing.T, sc *scenarioContext) {
		sc.withIdentity(&authn.Identity{})

		path := url.QueryEscape(`/\example.com`)
		sc.m.Get(url.QueryEscape(path), sc.defaultHandler)
		sc.fakeReq("GET", fmt.Sprintf("%s?orgId=3", path)).exec()

		require.Equal(t, 404, sc.resp.Code)
	})

	middlewareScenario(t, "works correctly when grafana is served under a subpath", func(t *testing.T, sc *scenarioContext) {
		sc.withIdentity(&authn.Identity{})

		sc.m.Get("/", sc.defaultHandler)
		sc.fakeReq("GET", "/?orgId=3").exec()

		require.Equal(t, 302, sc.resp.Code)
		require.Equal(t, "/grafana/?orgId=3", sc.resp.Header().Get("Location"))
	}, func(cfg *setting.Cfg) {
		cfg.AppURL = "http://localhost:3000/grafana/"
		cfg.AppSubURL = "/grafana"
	})
}
