package clients

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func stringPtr(s string) *string {
	return &s
}

func TestAuthenticateJWT(t *testing.T) {
	jwtService := &models.FakeJWTService{
		VerifyProvider: func(context.Context, string) (models.JWTClaims, error) {
			return models.JWTClaims{
				"sub":                "1234567890",
				"email":              "eai.doe@cor.po",
				"preferred_username": "eai-doe",
				"name":               "Eai Doe",
				"roles":              "Admin",
			}, nil
		},
	}
	jwtHeaderName := "X-Forwarded-User"
	wantID := &authn.Identity{
		OrgID:          0,
		OrgCount:       0,
		OrgName:        "",
		OrgRoles:       map[int64]roletype.RoleType{1: roletype.RoleAdmin},
		ID:             "",
		Login:          "eai-doe",
		Name:           "Eai Doe",
		Email:          "eai.doe@cor.po",
		IsGrafanaAdmin: boolPtr(false),
		AuthModule:     "jwt",
		AuthID:         "1234567890",
		IsDisabled:     false,
		HelpFlags1:     0,
		ClientParams: authn.ClientParams{
			SyncUser:        true,
			AllowSignUp:     true,
			SyncTeamMembers: true,
			LookUpParams: models.UserLookupParams{
				UserID: nil,
				Email:  stringPtr("eai.doe@cor.po"),
				Login:  stringPtr("eai-doe"),
			},
		},
	}

	cfg := &setting.Cfg{
		JWTAuthEnabled:                 true,
		JWTAuthHeaderName:              jwtHeaderName,
		JWTAuthEmailClaim:              "email",
		JWTAuthUsernameClaim:           "preferred_username",
		JWTAuthAutoSignUp:              true,
		JWTAuthAllowAssignGrafanaAdmin: true,
		JWTAuthRoleAttributeStrict:     true,
		JWTAuthRoleAttributePath:       "roles",
	}
	jwtClient := ProvideJWT(jwtService, cfg)
	validHTTPReq := &http.Request{
		Header: map[string][]string{
			jwtHeaderName: {"sample-token"}},
	}

	id, err := jwtClient.Authenticate(context.Background(), &authn.Request{
		OrgID:       1,
		HTTPRequest: validHTTPReq,
		Resp:        nil,
	})
	require.NoError(t, err)

	assert.EqualValues(t, wantID, id, fmt.Sprintf("%+v", id))
}

func TestJWTTest(t *testing.T) {
	jwtService := &models.FakeJWTService{}
	jwtHeaderName := "X-Forwarded-User"
	validFormatToken := "sample.token.valid"
	invalidFormatToken := "sampletokeninvalid"

	type testCase struct {
		desc          string
		reqHeaderName string
		cfgHeaderName string
		urlLogin      bool
		token         string
		want          bool
	}

	testCases := []testCase{
		{
			desc:          "valid",
			reqHeaderName: jwtHeaderName,
			cfgHeaderName: jwtHeaderName,
			token:         validFormatToken,
			want:          true,
		},
		{
			desc:          "not in the right header",
			reqHeaderName: "other-header",
			cfgHeaderName: jwtHeaderName,
			token:         validFormatToken,
			want:          false,
		},
		{
			desc:          "valid format in Authorization",
			reqHeaderName: "Authorization",
			cfgHeaderName: "Authorization",
			token:         validFormatToken,
			want:          true,
		},
		{
			desc:          "invalid format in Authorization",
			reqHeaderName: "Authorization",
			cfgHeaderName: "Authorization",
			token:         invalidFormatToken,
			want:          false,
		},
		{
			desc:          "url login enabled",
			reqHeaderName: "other-header",
			cfgHeaderName: jwtHeaderName,
			urlLogin:      true,
			token:         validFormatToken,
			want:          true,
		},
		{
			desc:          "url login enabled",
			reqHeaderName: "other-header",
			cfgHeaderName: jwtHeaderName,
			urlLogin:      false,
			token:         validFormatToken,
			want:          false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			cfg := &setting.Cfg{
				JWTAuthEnabled:                 true,
				JWTAuthURLLogin:                tc.urlLogin,
				JWTAuthHeaderName:              tc.cfgHeaderName,
				JWTAuthAutoSignUp:              true,
				JWTAuthAllowAssignGrafanaAdmin: true,
				JWTAuthRoleAttributeStrict:     true,
			}
			jwtClient := ProvideJWT(jwtService, cfg)
			httpReq := &http.Request{
				URL: &url.URL{RawQuery: "auth_token=" + tc.token},
				Header: map[string][]string{
					tc.reqHeaderName: {tc.token}},
			}

			got := jwtClient.Test(context.Background(), &authn.Request{
				OrgID:       1,
				HTTPRequest: httpReq,
				Resp:        nil,
			})

			require.Equal(t, tc.want, got)
		})
	}
}
