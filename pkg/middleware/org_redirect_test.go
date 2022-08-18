package middleware

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
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
			sc.mockSQLStore.ExpectedSignedInUser = &user.SignedInUser{OrgID: 1, UserID: 12}
			sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
				return &models.UserToken{
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
		sc.mockSQLStore.ExpectedSetUsingOrgError = fmt.Errorf("")
		sc.mockSQLStore.ExpectedSignedInUser = &user.SignedInUser{OrgID: 1, UserID: 12}

		sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
			return &models.UserToken{
				UserId:        12,
				UnhashedToken: "",
			}, nil
		}

		sc.m.Get("/", sc.defaultHandler)
		sc.fakeReq("GET", "/?orgId=3").exec()

		require.Equal(t, 404, sc.resp.Code)
	})
}
