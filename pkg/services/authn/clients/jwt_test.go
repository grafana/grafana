package clients

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func stringPtr(s string) *string {
	return &s
}

func TestAuthenticateJWT(t *testing.T) {
	t.Parallel()

	jwtHeaderName := "X-Forwarded-User"

	testCases := []struct {
		name           string
		wantID         *authn.Identity
		verifyProvider func(context.Context, string) (map[string]any, error)
		cfg            *setting.Cfg
	}{
		{
			name: "Valid Use case with group path",
			wantID: &authn.Identity{
				OrgID:           0,
				OrgName:         "",
				OrgRoles:        map[int64]identity.RoleType{1: identity.RoleAdmin},
				Groups:          []string{"foo", "bar"},
				Login:           "eai-doe",
				Name:            "Eai Doe",
				Email:           "eai.doe@cor.po",
				IsGrafanaAdmin:  boolPtr(false),
				AuthenticatedBy: login.JWTModule,
				AuthID:          "1234567890",
				IsDisabled:      false,
				HelpFlags1:      0,
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					SyncPermissions: true,
					SyncTeams:       true,
					LookUpParams: login.UserLookupParams{
						Email: stringPtr("eai.doe@cor.po"),
						Login: stringPtr("eai-doe"),
					},
				},
			},
			verifyProvider: func(context.Context, string) (map[string]any, error) {
				return map[string]any{
					"sub":                "1234567890",
					"email":              "eai.doe@cor.po",
					"preferred_username": "eai-doe",
					"name":               "Eai Doe",
					"roles":              "Admin",
					"groups":             []string{"foo", "bar"},
				}, nil
			},
			cfg: &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:                 true,
					HeaderName:              jwtHeaderName,
					EmailClaim:              "email",
					UsernameClaim:           "preferred_username",
					AutoSignUp:              true,
					AllowAssignGrafanaAdmin: true,
					RoleAttributeStrict:     true,
					RoleAttributePath:       "roles",
					GroupsAttributePath:     "groups[]",
				},
			},
		},
		{
			name: "Valid Use case without group path",
			wantID: &authn.Identity{
				OrgID:           0,
				OrgName:         "",
				OrgRoles:        map[int64]identity.RoleType{1: identity.RoleAdmin},
				Login:           "eai-doe",
				Groups:          []string{},
				Name:            "Eai Doe",
				Email:           "eai.doe@cor.po",
				IsGrafanaAdmin:  boolPtr(false),
				AuthenticatedBy: login.JWTModule,
				AuthID:          "1234567890",
				IsDisabled:      false,
				HelpFlags1:      0,
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					SyncPermissions: true,
					SyncTeams:       false,
					LookUpParams: login.UserLookupParams{
						Email: stringPtr("eai.doe@cor.po"),
						Login: stringPtr("eai-doe"),
					},
				},
			},
			verifyProvider: func(context.Context, string) (map[string]any, error) {
				return map[string]any{
					"sub":                "1234567890",
					"email":              "eai.doe@cor.po",
					"preferred_username": "eai-doe",
					"name":               "Eai Doe",
					"roles":              "Admin",
					"groups":             []string{"foo", "bar"},
				}, nil
			},
			cfg: &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:                 true,
					HeaderName:              jwtHeaderName,
					EmailClaim:              "email",
					UsernameClaim:           "preferred_username",
					AutoSignUp:              true,
					AllowAssignGrafanaAdmin: true,
					RoleAttributeStrict:     true,
					RoleAttributePath:       "roles",
				},
			},
		},
		{
			name: "Valid Use case with org_mapping",
			wantID: &authn.Identity{
				OrgID:           0,
				OrgName:         "",
				OrgRoles:        map[int64]identity.RoleType{4: identity.RoleEditor, 5: identity.RoleViewer},
				Login:           "eai-doe",
				Groups:          []string{"foo", "bar"},
				Name:            "Eai Doe",
				Email:           "eai.doe@cor.po",
				IsGrafanaAdmin:  boolPtr(false),
				AuthenticatedBy: login.JWTModule,
				AuthID:          "1234567890",
				IsDisabled:      false,
				HelpFlags1:      0,
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					SyncPermissions: true,
					SyncTeams:       true,
					LookUpParams: login.UserLookupParams{
						Email: stringPtr("eai.doe@cor.po"),
						Login: stringPtr("eai-doe"),
					},
				},
			},
			verifyProvider: func(context.Context, string) (map[string]any, error) {
				return map[string]any{
					"sub":                "1234567890",
					"email":              "eai.doe@cor.po",
					"preferred_username": "eai-doe",
					"name":               "Eai Doe",
					"roles":              "None",
					"groups":             []string{"foo", "bar"},
					"orgs":               []string{"org1", "org2"},
				}, nil
			},
			cfg: &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:                 true,
					HeaderName:              jwtHeaderName,
					EmailClaim:              "email",
					UsernameClaim:           "preferred_username",
					AutoSignUp:              true,
					AllowAssignGrafanaAdmin: true,
					RoleAttributeStrict:     true,
					RoleAttributePath:       "roles",
					GroupsAttributePath:     "groups[]",
					OrgAttributePath:        "orgs[]",
					OrgMapping:              []string{"org1:Org4:Editor", "org2:Org5:Viewer"},
				},
			},
		},
		{
			name: "Invalid Use case with org_mapping and invalid roles",
			wantID: &authn.Identity{
				OrgID:           0,
				OrgName:         "",
				OrgRoles:        map[int64]identity.RoleType{4: identity.RoleEditor, 5: identity.RoleViewer},
				Login:           "eai-doe",
				Groups:          []string{"foo", "bar"},
				Name:            "Eai Doe",
				Email:           "eai.doe@cor.po",
				IsGrafanaAdmin:  boolPtr(false),
				AuthenticatedBy: login.JWTModule,
				AuthID:          "1234567890",
				IsDisabled:      false,
				HelpFlags1:      0,
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					SyncPermissions: true,
					SyncTeams:       true,
					LookUpParams: login.UserLookupParams{
						Email: stringPtr("eai.doe@cor.po"),
						Login: stringPtr("eai-doe"),
					},
				},
			},
			verifyProvider: func(context.Context, string) (map[string]any, error) {
				return map[string]any{
					"sub":                "1234567890",
					"email":              "eai.doe@cor.po",
					"preferred_username": "eai-doe",
					"name":               "Eai Doe",
					"roles":              []string{"Invalid"},
					"groups":             []string{"foo", "bar"},
					"orgs":               []string{"org1", "org2"},
				}, nil
			},
			cfg: &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:                 true,
					HeaderName:              jwtHeaderName,
					EmailClaim:              "email",
					UsernameClaim:           "preferred_username",
					AutoSignUp:              true,
					AllowAssignGrafanaAdmin: true,
					RoleAttributeStrict:     true,
					RoleAttributePath:       "roles",
					GroupsAttributePath:     "groups[]",
					OrgAttributePath:        "orgs[]",
					OrgMapping:              []string{"org1:Org4:Editor", "org2:Org5:Viewer"},
				},
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			jwtService := &jwt.FakeJWTService{
				VerifyProvider: tc.verifyProvider,
			}

			jwtClient := ProvideJWT(jwtService,
				connectors.ProvideOrgRoleMapper(tc.cfg,
					&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				tc.cfg, tracing.InitializeTracerForTest())
			validHTTPReq := &http.Request{
				Header: map[string][]string{
					jwtHeaderName: {"sample-token"}},
			}

			id, err := jwtClient.Authenticate(context.Background(), &authn.Request{
				OrgID:       1,
				HTTPRequest: validHTTPReq,
			})
			require.NoError(t, err)

			assert.EqualValues(t, tc.wantID, id, fmt.Sprintf("%+v", id))
		})
	}
}

func TestJWTClaimConfig(t *testing.T) {
	t.Parallel()
	jwtService := &jwt.FakeJWTService{
		VerifyProvider: func(context.Context, string) (map[string]any, error) {
			return map[string]any{
				"sub":                "1234567890",
				"email":              "eai.doe@cor.po",
				"preferred_username": "eai-doe",
				"name":               "Eai Doe",
				"roles":              "Admin",
			}, nil
		},
	}

	jwtHeaderName := "X-Forwarded-User"

	// #nosec G101 -- This is a dummy/test token
	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o"

	type testCase struct {
		desc                 string
		claimsConfigurations []util.DynMap
		valid                bool
	}

	testCases := []testCase{
		{
			desc: "JWT configuration with email and username claims",
			claimsConfigurations: []util.DynMap{
				{
					"JWTAuthEmailClaim":    true,
					"JWTAuthUsernameClaim": true,
				},
			},
			valid: true,
		},
		{
			desc: "JWT configuration with email claim",
			claimsConfigurations: []util.DynMap{
				{
					"JWTAuthEmailClaim":    true,
					"JWTAuthUsernameClaim": false,
				},
			},
			valid: true,
		},
		{
			desc: "JWT configuration with username claim",
			claimsConfigurations: []util.DynMap{
				{
					"JWTAuthEmailClaim":    false,
					"JWTAuthUsernameClaim": true,
				},
			},
			valid: true,
		},
		{
			desc: "JWT configuration without email and username claims",
			claimsConfigurations: []util.DynMap{
				{
					"JWTAuthEmailClaim":    false,
					"JWTAuthUsernameClaim": false,
				},
			},
			valid: false,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.desc, func(t *testing.T) {
			t.Parallel()
			cfg := &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:                 true,
					HeaderName:              jwtHeaderName,
					AutoSignUp:              true,
					AllowAssignGrafanaAdmin: true,
					RoleAttributeStrict:     true,
					RoleAttributePath:       "roles",
				},
			}
			for _, claims := range tc.claimsConfigurations {
				cfg.JWTAuth.EmailClaim = ""
				cfg.JWTAuth.UsernameClaim = ""

				if claims["JWTAuthEmailClaim"] == true {
					cfg.JWTAuth.EmailClaim = "email"
				}
				if claims["JWTAuthUsernameClaim"] == true {
					cfg.JWTAuth.UsernameClaim = "preferred_username"
				}
			}

			httpReq := &http.Request{
				URL: &url.URL{RawQuery: "auth_token=" + token},
				Header: map[string][]string{
					jwtHeaderName: {token}},
			}
			jwtClient := ProvideJWT(jwtService, connectors.ProvideOrgRoleMapper(cfg,
				&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				cfg, tracing.InitializeTracerForTest())
			_, err := jwtClient.Authenticate(context.Background(), &authn.Request{
				OrgID:       1,
				HTTPRequest: httpReq,
			})
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestJWTTest(t *testing.T) {
	t.Parallel()
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
		tc := tc
		t.Run(tc.desc, func(t *testing.T) {
			t.Parallel()
			cfg := &setting.Cfg{
				JWTAuth: setting.AuthJWTSettings{
					Enabled:                 true,
					URLLogin:                tc.urlLogin,
					HeaderName:              tc.cfgHeaderName,
					AutoSignUp:              true,
					AllowAssignGrafanaAdmin: true,
					RoleAttributeStrict:     true,
				},
			}
			jwtClient := ProvideJWT(jwtService,
				connectors.ProvideOrgRoleMapper(cfg,
					&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
				cfg, tracing.InitializeTracerForTest())
			httpReq := &http.Request{
				URL: &url.URL{RawQuery: "auth_token=" + tc.token},
				Header: map[string][]string{
					tc.reqHeaderName: {tc.token}},
			}

			got := jwtClient.Test(context.Background(), &authn.Request{
				OrgID:       1,
				HTTPRequest: httpReq,
			})

			require.Equal(t, tc.want, got)
		})
	}
}

func TestJWTStripParam(t *testing.T) {
	t.Parallel()
	jwtService := &jwt.FakeJWTService{
		VerifyProvider: func(context.Context, string) (map[string]any, error) {
			return map[string]any{
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
		JWTAuth: setting.AuthJWTSettings{
			Enabled:                 true,
			HeaderName:              jwtHeaderName,
			AutoSignUp:              true,
			AllowAssignGrafanaAdmin: true,
			URLLogin:                true,
			RoleAttributeStrict:     false,
			RoleAttributePath:       "roles",
			EmailClaim:              "email",
			UsernameClaim:           "preferred_username",
		},
	}

	// #nosec G101 -- This is a dummy/test token
	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.XbPfbIHMI6arZ3Y922BhjWgQzWXcXNrz0ogtVhfEd2o"

	httpReq := &http.Request{
		URL: &url.URL{RawQuery: "auth_token=" + token + "&other_param=other_value"},
	}
	jwtClient := ProvideJWT(jwtService,
		connectors.ProvideOrgRoleMapper(cfg,
			&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
		cfg, tracing.InitializeTracerForTest())
	_, err := jwtClient.Authenticate(context.Background(), &authn.Request{
		OrgID:       1,
		HTTPRequest: httpReq,
	})
	require.NoError(t, err)
	// auth_token should be removed from the query string
	assert.Equal(t, "other_param=other_value", httpReq.URL.RawQuery)
}

func TestJWTSubClaimsConfig(t *testing.T) {
	t.Parallel()

	// #nosec G101 -- This is a dummy/test token
	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ2ZXIiOiIxLjAiLCJpc3MiOiJodHRwczovL2F6dXJlZG9tYWlubmFtZS5iMmNsb2dpbi5jb20vNjIwYjI2MzQtYmI4OC00MzdiLTgwYWQtYWM0YTkwZGZkZTkxL3YyLjAvIiwic3ViIjoiOWI4OTg5MDgtMWFlYy00NDc1LTljNDgtNzg1MWQyNjVkZGIxIiwiYXVkIjoiYmEyNzM0NDktMmZiNS00YTRhLTlmODItYTA2MTRhM2MxODQ1IiwiZXhwIjoxNzExNTYwMDcxLCJub25jZSI6ImRlZmF1bHROb25jZSIsImlhdCI6MTcxMTU1NjQ3MSwiYXV0aF90aW1lIjoxNzExNTU2NDcxLCJuYW1lIjoibmFtZV9vZl90aGVfdXNlciIsImdpdmVuX25hbWUiOiJVc2VyTmFtZSIsImZhbWlseV9uYW1lIjoiVXNlclN1cm5hbWUiLCJlbWFpbHMiOlsibWFpbmVtYWlsK2V4dHJhZW1haWwwNUBnbWFpbC5jb20iLCJtYWluZW1haWwrZXh0cmFlbWFpbDA0QGdtYWlsLmNvbSIsIm1haW5lbWFpbCtleHRyYWVtYWlsMDNAZ21haWwuY29tIiwibWFpbmVtYWlsK2V4dHJhZW1haWwwMkBnbWFpbC5jb20iLCJtYWluZW1haWwrZXh0cmFlbWFpbDAxQGdtYWlsLmNvbSIsIm1haW5lbWFpbEBnbWFpbC5jb20iXSwidGZwIjoiQjJDXzFfdXNlcmZsb3ciLCJuYmYiOjE3MTE1NTY0NzF9.qpN3upxUB5CTJ7kmYPHFuhlwG95vdQqJaDDC_8KJFZ8"
	jwtHeaderName := "X-Forwarded-User"
	response := map[string]any{
		"ver":         "1.0",
		"iss":         "https://azuredomainname.b2clogin.com/620b2634-bb88-437b-80ad-ac4a90dfde91/v2.0/",
		"sub":         "9b898908-1aec-4475-9c48-7851d265ddb1",
		"aud":         "ba273449-2fb5-4a4a-9f82-a0614a3c1845",
		"exp":         1711560071,
		"nonce":       "defaultNonce",
		"iat":         1711556471,
		"auth_time":   1711556471,
		"name":        "name_of_the_user",
		"given_name":  "UserName",
		"family_name": "UserSurname",
		"emails": []string{
			"mainemail+extraemail04@gmail.com",
			"mainemail+extraemail03@gmail.com",
			"mainemail+extraemail02@gmail.com",
			"mainemail+extraemail01@gmail.com",
			"mainemail@gmail.com",
		},
		"tfp": "B2C_1_userflow",
		"nbf": 1711556471,
	}
	cfg := &setting.Cfg{
		JWTAuth: setting.AuthJWTSettings{
			HeaderName:            jwtHeaderName,
			EmailAttributePath:    "emails[2]",
			UsernameAttributePath: "name",
		},
	}
	httpReq := &http.Request{
		URL: &url.URL{RawQuery: "auth_token=" + token},
		Header: map[string][]string{
			jwtHeaderName: {token}},
	}
	jwtService := &jwt.FakeJWTService{
		VerifyProvider: func(context.Context, string) (map[string]any, error) {
			return response, nil
		},
	}

	jwtClient := ProvideJWT(jwtService,
		connectors.ProvideOrgRoleMapper(cfg,
			&orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 4, Name: "Org4"}, {ID: 5, Name: "Org5"}}}),
		cfg, tracing.InitializeTracerForTest())
	identity, err := jwtClient.Authenticate(context.Background(), &authn.Request{
		OrgID:       1,
		HTTPRequest: httpReq,
	})
	require.NoError(t, err)
	require.Equal(t, "mainemail+extraemail02@gmail.com", identity.Email)
	require.Equal(t, "name_of_the_user", identity.Name)
	fmt.Println("identity.Email", identity.Email)
}
