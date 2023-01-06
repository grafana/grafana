package middleware

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/user"
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
			sc.withTokenSessionCookie("token")
			sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 1, UserID: 12}
			sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
				return &auth.UserToken{
					UserId:        0,
					UnhashedToken: "",
				}, nil
			}

			sc.m.Get("/", sc.defaultHandler)
			sc.fakeReq("GET", tc.input).exec()

			require.Equal(t, tc.expStatus, sc.resp.Code)
			require.Equal(t, tc.expLocation, sc.resp.Header().Get("Location"))
		})
	}

	middlewareScenario(t, "when setting an invalid org for user", func(t *testing.T, sc *scenarioContext) {
		sc.withTokenSessionCookie("token")
		sc.userService.ExpectedSetUsingOrgError = fmt.Errorf("")
		sc.userService.ExpectedSignedInUser = &user.SignedInUser{OrgID: 1, UserID: 12}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
			return &auth.UserToken{
				UserId:        12,
				UnhashedToken: "",
			}, nil
		}

		sc.m.Get("/", sc.defaultHandler)
		sc.fakeReq("GET", "/?orgId=3").exec()

		require.Equal(t, 404, sc.resp.Code)
	})
}
