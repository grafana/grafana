package middleware

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authn"
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
			desc:        "when setting a correct org for the user with '&kiosk'",
			input:       "/?orgId=3&kiosk",
			expStatus:   302,
			expLocation: "/?orgId=3&kiosk",
		},
		{
			desc:        "when setting a correct org for the user with '&kiosk='",
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

	appSubURL := []string{"", "/grafana"}

	for _, tc := range testCases {
		for _, u := range appSubURL {
			middlewareScenario(t, fmt.Sprintf("%s with appSubURL=%s", tc.desc, u), func(t *testing.T, sc *scenarioContext) {
				sc.withAppSubURL(u)
        sc.withIdentity(&authn.Identity{})
				sc.m.Get(u, sc.defaultHandler)
				sc.fakeReq("GET", tc.input).exec()

				require.Equal(t, tc.expStatus, sc.resp.Code)
				require.Equal(t, u+tc.expLocation, sc.resp.Header().Get("Location"))
			})
		}
	}

	middlewareScenario(t, "when setting an invalid org for user", func(t *testing.T, sc *scenarioContext) {
		sc.withIdentity(&authn.Identity{})
		sc.userService.ExpectedSetUsingOrgError = fmt.Errorf("")

		sc.m.Get("/", sc.defaultHandler)
		sc.fakeReq("GET", "/?orgId=1").exec()

		require.Equal(t, 404, sc.resp.Code)
	})
}
