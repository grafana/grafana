package clients

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
)

func stringPtr(s string) *string {
	return &s
}

func TestAuthenticateJWT(t *testing.T) {
	jwtService := &jwt.FakeJWTService{
		VerifyProvider: func(context.Context, string) (jwt.JWTClaims, error) {
			return jwt.JWTClaims{
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
			FetchSyncedUser: true,
			SyncOrgRoles:    true,
			SyncPermissions: true,
			LookUpParams: login.UserLookupParams{
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

func TestJWTClaimConfig(t *testing.T) {
	jwtService := &jwt.FakeJWTService{
		VerifyProvider: func(context.Context, string) (jwt.JWTClaims, error) {
			return jwt.JWTClaims{
				"sub":                "1234567890",
				"email":              "eai.doe@cor.po",
				"preferred_username": "eai-doe",
				"name":               "Eai Doe",
				"roles":              "Admin",
			}, nil
		},
	}

	jwtHeaderName := "X-Forwarded-User"

	cfg := &setting.Cfg{
		JWTAuthEnabled:                 true,
		JWTAuthHeaderName:              jwtHeaderName,
		JWTAuthAutoSignUp:              true,
		JWTAuthAllowAssignGrafanaAdmin: true,
		JWTAuthRoleAttributeStrict:     true,
		JWTAuthRoleAttributePath:       "roles",
	}

	// #nosec G101 -- This is a dummy/test token
	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o"

	type Dictionary map[string]interface{}

	type testCase struct {
		desc                 string
		claimsConfigurations []Dictionary
		valid                bool
	}

	testCases := []testCase{
		{
			desc: "JWT configuration with email and username claims",
			claimsConfigurations: []Dictionary{
				{
					"JWTAuthEmailClaim":    true,
					"JWTAuthUsernameClaim": true,
				},
			},
			valid: true,
		},
		{
			desc: "JWT configuration with email claim",
			claimsConfigurations: []Dictionary{
				{
					"JWTAuthEmailClaim":    true,
					"JWTAuthUsernameClaim": false,
				},
			},
			valid: true,
		},
		{
			desc: "JWT configuration with username claim",
			claimsConfigurations: []Dictionary{
				{
					"JWTAuthEmailClaim":    false,
					"JWTAuthUsernameClaim": true,
				},
			},
			valid: true,
		},
		{
			desc: "JWT configuration without email and username claims",
			claimsConfigurations: []Dictionary{
				{
					"JWTAuthEmailClaim":    false,
					"JWTAuthUsernameClaim": false,
				},
			},
			valid: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			for _, claims := range tc.claimsConfigurations {
				cfg.JWTAuthEmailClaim = ""
				cfg.JWTAuthUsernameClaim = ""

				if claims["JWTAuthEmailClaim"] == true {
					cfg.JWTAuthEmailClaim = "email"
				}
				if claims["JWTAuthUsernameClaim"] == true {
					cfg.JWTAuthUsernameClaim = "preferred_username"
				}
			}
		})
		httpReq := &http.Request{
			URL: &url.URL{RawQuery: "auth_token=" + token},
			Header: map[string][]string{
				jwtHeaderName: {token}},
		}
		jwtClient := ProvideJWT(jwtService, cfg)
		_, err := jwtClient.Authenticate(context.Background(), &authn.Request{
			OrgID:       1,
			HTTPRequest: httpReq,
			Resp:        nil,
		})
		if tc.valid {
			require.NoError(t, err)
		} else {
			require.Error(t, err)
		}
	}
}

func TestJWTTest(t *testing.T) {
	jwtService := &jwt.FakeJWTService{}
	jwtHeaderName := "X-Forwarded-User"
	// #nosec G101 -- This is dummy/test token
	validFormatToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o"
	invalidFormatToken := "sampletokeninvalid"
	// #nosec G101 -- This is dummy/test token
	missingSubToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJpYXQiOjE1MTYyMzkwMjJ9.8nYFUX869Y1mnDDDU4yL11aANgVRuifoxrE8BHZY1iE"
	// #nosec G101 -- This is dummy/test token
	emptySubToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJzdWIiOiIiLCJpYXQiOjE1MTYyMzkwMjJ9.tnwtOHK58d47dO4DHW4b9MzeToxa1kGiko5Oo887Rqc"

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
		{
			desc:          "token without a sub claim",
			reqHeaderName: "Authorization",
			cfgHeaderName: "Authorization",
			token:         missingSubToken,
			want:          false,
		},
		{
			desc:          "token with an empty sub claim",
			reqHeaderName: "Authorization",
			cfgHeaderName: "Authorization",
			token:         emptySubToken,
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
