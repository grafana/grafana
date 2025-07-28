package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func setUpGetOrgUsersDB(t *testing.T, sqlStore db.DB, cfg *setting.Cfg) {
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = int(testOrgID)

	quotaService := quotaimpl.ProvideService(sqlStore, cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		sqlStore, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(),
	)
	require.NoError(t, err)

	id, err := orgService.GetOrCreate(context.Background(), "testOrg")
	require.NoError(t, err)
	require.Equal(t, testOrgID, id)

	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Email: "testUser@grafana.com", Login: testUserLogin})
	require.NoError(t, err)
	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Email: "user1@grafana.com", Login: "user1"})
	require.NoError(t, err)
	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Email: "user2@grafana.com", Login: "user2"})
	require.NoError(t, err)
}

func TestIntegrationOrgUsersAPIEndpoint_userLoggedIn(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	hs := setupSimpleHTTPServer(featuremgmt.WithFeatures())
	settings := hs.Cfg

	sqlStore := db.InitTestDB(t, sqlstore.InitTestDBOpt{Cfg: settings})
	hs.SQLStore = sqlStore
	orgService := orgtest.NewOrgServiceFake()
	orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{}
	hs.orgService = orgService
	setUpGetOrgUsersDB(t, sqlStore, settings)
	mock := dbtest.NewFakeDB()

	loggedInUserScenario(t, "When calling GET on", "api/org/users", "api/org/users", func(sc *scenarioContext) {
		orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{
			OrgUsers: []*org.OrgUserDTO{
				{Login: testUserLogin, Email: "testUser@grafana.com"},
				{Login: "user1", Email: "user1@grafana.com"},
				{Login: "user2", Email: "user2@grafana.com"},
			},
		}
		sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp []org.OrgUserDTO
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Len(t, resp, 3)
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "api/org/users/search", "api/org/users/search", func(sc *scenarioContext) {
		orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{
			OrgUsers: []*org.OrgUserDTO{
				{
					Login: "user1",
				},
				{
					Login: "user2",
				},
				{
					Login: "user3",
				},
			},
			TotalCount: 3,
			PerPage:    1000,
			Page:       1,
		}
		sc.handlerFunc = hs.SearchOrgUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp org.SearchOrgUsersQueryResult
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)

		assert.Len(t, resp.OrgUsers, 3)
		assert.Equal(t, int64(3), resp.TotalCount)
		assert.Equal(t, 1000, resp.PerPage)
		assert.Equal(t, 1, resp.Page)
	}, mock)

	loggedInUserScenario(t, "When calling GET with page and limit query parameters on", "api/org/users/search", "api/org/users/search", func(sc *scenarioContext) {
		orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{
			OrgUsers: []*org.OrgUserDTO{
				{
					Login: "user1",
				},
			},
			TotalCount: 3,
			PerPage:    2,
			Page:       2,
		}

		sc.handlerFunc = hs.SearchOrgUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "2", "page": "2"}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp org.SearchOrgUsersQueryResult
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)

		assert.Len(t, resp.OrgUsers, 1)
		assert.Equal(t, int64(3), resp.TotalCount)
		assert.Equal(t, 2, resp.PerPage)
		assert.Equal(t, 2, resp.Page)
	}, mock)

	t.Run("Given there are two hidden users", func(t *testing.T) {
		settings.HiddenUsers = map[string]struct{}{
			"user1":       {},
			testUserLogin: {},
		}
		t.Cleanup(func() { settings.HiddenUsers = make(map[string]struct{}) })

		loggedInUserScenario(t, "When calling GET on", "api/org/users", "api/org/users", func(sc *scenarioContext) {
			orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{
				OrgUsers: []*org.OrgUserDTO{
					{Login: testUserLogin, Email: "testUser@grafana.com"},
					{Login: "user1", Email: "user1@grafana.com"},
					{Login: "user2", Email: "user2@grafana.com"},
				},
			}

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []org.OrgUserDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)
			assert.Len(t, resp, 2)
			assert.Equal(t, testUserLogin, resp[0].Login)
			assert.Equal(t, "user2", resp[1].Login)
		}, mock)

		loggedInUserScenarioWithRole(t, "When calling GET as an admin on", "GET", "api/org/users/lookup",
			"api/org/users/lookup", org.RoleAdmin, func(sc *scenarioContext) {
				sc.handlerFunc = hs.GetOrgUsersForCurrentOrgLookup
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, http.StatusOK, sc.resp.Code)

				var resp []dtos.UserLookupDTO
				err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Len(t, resp, 2)
				assert.Equal(t, testUserLogin, resp[0].Login)
				assert.Equal(t, "user2", resp[1].Login)
			}, mock)
	})
}

func TestOrgUsersAPIEndpoint_updateOrgRole(t *testing.T) {
	type testCase struct {
		desc            string
		SkipOrgRoleSync bool
		AuthEnabled     bool
		AuthModule      string
		expectedCode    int
	}
	permissions := []accesscontrol.Permission{
		{Action: accesscontrol.ActionOrgUsersRead, Scope: "users:*"},
		{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"},
		{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:*"},
		{Action: accesscontrol.ActionOrgUsersRemove, Scope: "users:*"},
	}
	tests := []testCase{
		{
			desc:            "should be able to change basicRole when skip_org_role_sync true",
			SkipOrgRoleSync: true,
			AuthEnabled:     true,
			AuthModule:      login.LDAPAuthModule,
			expectedCode:    http.StatusOK,
		},
		{
			desc:            "should not be able to change basicRole when skip_org_role_sync false",
			SkipOrgRoleSync: false,
			AuthEnabled:     true,
			AuthModule:      login.LDAPAuthModule,
			expectedCode:    http.StatusForbidden,
		},
		{
			desc:            "should not be able to change basicRole for a user synced through an OAuth provider",
			SkipOrgRoleSync: false,
			AuthEnabled:     true,
			AuthModule:      login.GrafanaComAuthModule,
			expectedCode:    http.StatusForbidden,
		},
		{
			desc:            "should be able to change basicRole with a basic Auth",
			SkipOrgRoleSync: false,
			AuthEnabled:     false,
			AuthModule:      "",
			expectedCode:    http.StatusOK,
		},
		{
			desc:            "should be able to change basicRole with a basic Auth",
			SkipOrgRoleSync: true,
			AuthEnabled:     true,
			AuthModule:      "",
			expectedCode:    http.StatusOK,
		},
	}

	userWithPermissions := userWithPermissions(1, permissions)
	userRequesting := &user.User{ID: 2, OrgID: 1}
	reqBody := `{"userId": "1", "role": "Admin", "orgId": "1"}`
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.Cfg.LDAPAuthEnabled = tt.AuthEnabled
				switch tt.AuthModule {
				case login.LDAPAuthModule:
					hs.Cfg.LDAPAuthEnabled = tt.AuthEnabled
					hs.Cfg.LDAPSkipOrgRoleSync = tt.SkipOrgRoleSync
				case login.GrafanaComAuthModule:
					hs.authnService = &authntest.FakeService{
						EnabledClients: []string{authn.ClientWithPrefix("grafana_com")},
						ExpectedClientConfig: &authntest.FakeSSOClientConfig{
							ExpectedIsSkipOrgRoleSyncEnabled: tt.SkipOrgRoleSync,
						},
					}
				}
				// AuthModule empty means basic auth

				hs.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{AuthModule: tt.AuthModule},
				}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: userWithPermissions}
				hs.orgService = &orgtest.FakeOrgService{}
				hs.SocialService = &socialtest.FakeSocialService{
					ExpectedAuthInfoProvider: &social.OAuthInfo{Enabled: tt.AuthEnabled, SkipOrgRoleSync: tt.SkipOrgRoleSync},
				}
				hs.accesscontrolService = &actest.FakeService{
					ExpectedPermissions: permissions,
				}
			})
			req := server.NewRequest(http.MethodPatch, fmt.Sprintf("/api/orgs/%d/users/%d", userRequesting.OrgID, userRequesting.ID), strings.NewReader(reqBody))
			req.Header.Set("Content-Type", "application/json")
			userWithPermissions.OrgRole = identity.RoleAdmin
			res, err := server.Send(webtest.RequestWithSignedInUser(req, userWithPermissions))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestOrgUsersAPIEndpoint(t *testing.T) {
	type testCase struct {
		desc         string
		permissions  []accesscontrol.Permission
		expectedCode int
	}
	tests := []testCase{
		{
			expectedCode: http.StatusOK,
			desc:         "UsersLookupGet should return 200 for user with correct permissions",
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll}},
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "UsersLookupGet should return 403 for user without required permissions",
			permissions:  []accesscontrol.Permission{{Action: "wrong"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{ExpectedSearchOrgUsersResult: &org.SearchOrgUsersQueryResult{}}
				hs.authInfoService = &authinfotest.FakeService{}
			})
			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/org/users/lookup"), userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestGetOrgUsersAPIEndpoint_AccessControlMetadata(t *testing.T) {
	type testCase struct {
		desc             string
		permissions      []accesscontrol.Permission
		includeMetadata  bool
		expectedCode     int
		expectedMetadata map[string]bool
	}

	tests := []testCase{
		{
			desc:            "should not get access control metadata",
			includeMetadata: false,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersRead, Scope: "users:*"},
				{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"},
				{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:*"},
				{Action: accesscontrol.ActionOrgUsersRemove, Scope: "users:*"},
			},
			expectedCode:     http.StatusOK,
			expectedMetadata: nil,
		},
		{
			desc:            "should get access control metadata",
			includeMetadata: true,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersRead, Scope: "users:*"},
				{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"},
				{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:*"},
				{Action: accesscontrol.ActionOrgUsersRemove, Scope: "users:*"},
			},
			expectedCode: http.StatusOK,
			expectedMetadata: map[string]bool{
				"org.users:write":  true,
				"org.users:add":    true,
				"org.users:read":   true,
				"org.users:remove": true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{
					ExpectedSearchOrgUsersResult: &org.SearchOrgUsersQueryResult{OrgUsers: []*org.OrgUserDTO{{UserID: 1}}},
				}
				hs.authInfoService = &authinfotest.FakeService{}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: userWithPermissions(1, tt.permissions)}
				hs.accesscontrolService = actest.FakeService{ExpectedPermissions: tt.permissions}
			})

			url := "/api/orgs/1/users"
			if tt.includeMetadata {
				url += "?accesscontrol=true"
			}

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest(url), userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)

			var userList []*org.OrgUserDTO
			err = json.NewDecoder(res.Body).Decode(&userList)
			require.NoError(t, err)

			if tt.expectedMetadata != nil {
				assert.Equal(t, tt.expectedMetadata, userList[0].AccessControl)
			} else {
				assert.Nil(t, userList[0].AccessControl)
			}

			require.NoError(t, res.Body.Close())
		})
	}
}

func TestGetOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	type testCase struct {
		name         string
		permissions  []accesscontrol.Permission
		expectedCode int
		targetOrg    int64
	}

	tests := []testCase{
		{
			name: "user with permissions can get users in org",
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersRead, Scope: "users:*"},
			},
			expectedCode: http.StatusOK,
			targetOrg:    1,
		},
		{
			name:         "user without permissions cannot get users in org",
			expectedCode: http.StatusForbidden,
			targetOrg:    1,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{
					ExpectedSearchOrgUsersResult: &org.SearchOrgUsersQueryResult{},
				}
				hs.authInfoService = &authinfotest.FakeService{}
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: userWithPermissions(1, tc.permissions)}
				hs.accesscontrolService = &actest.FakeService{}
			})

			u := userWithPermissions(1, tc.permissions)

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest(fmt.Sprintf("/api/orgs/%d/users/", tc.targetOrg)), u))
			require.NoError(t, err)
			assert.Equal(t, tc.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestPostOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	type testCase struct {
		desc         string
		permissions  []accesscontrol.Permission
		input        string
		expectedCode int
	}

	tests := []testCase{
		{
			desc: "user with permissions can add users to org",
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersAdd, Scope: "users:*"},
			},
			input:        `{"loginOrEmail": "user", "role": "Viewer"}`,
			expectedCode: http.StatusOK,
		},
		{
			desc:         "user without permissions cannot add users to org",
			expectedCode: http.StatusForbidden,
			input:        `{"loginOrEmail": "user", "role": "Viewer"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{}
				hs.authInfoService = &authinfotest.FakeService{}
				hs.userService = &usertest.FakeUserService{
					ExpectedUser:         &user.User{},
					ExpectedSignedInUser: userWithPermissions(1, tt.permissions),
				}
				hs.accesscontrolService = &actest.FakeService{}
			})

			u := userWithPermissions(1, tt.permissions)

			res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewPostRequest("/api/orgs/1/users", strings.NewReader(tt.input)), u))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestOrgUsersAPIEndpointWithSetPerms_AccessControl(t *testing.T) {
	type testCase struct {
		expectedCode int
		desc         string
		url          string
		method       string
		role         org.RoleType
		permissions  []accesscontrol.Permission
		input        string
	}
	tests := []testCase{
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can add a user as a viewer to his org",
			url:          "/api/org/users",
			method:       http.MethodPost,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "user", "role": "Viewer"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot add a user as an editor to his org",
			url:          "/api/org/users",
			role:         org.RoleViewer,
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "user", "role": "Editor"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can add a user as a viewer to his org",
			url:          "/api/orgs/1/users",
			method:       http.MethodPost,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "user", "role": "Viewer"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot add a user as an editor to his org",
			url:          "/api/orgs/1/users",
			method:       http.MethodPost,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "user", "role": "Editor"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can update a user's role to a viewer in his org",
			url:          fmt.Sprintf("/api/org/users/%d", 1),
			method:       http.MethodPatch,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "Viewer"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot update a user's role to a Editorin his org",
			url:          fmt.Sprintf("/api/org/users/%d", 1),
			method:       http.MethodPatch,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "Editor"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can update a user's role to a viewer in his org",
			url:          fmt.Sprintf("/api/orgs/1/users/%d", 1),
			method:       http.MethodPatch,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "Viewer"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot update a user's role to a editor in his org",
			url:          fmt.Sprintf("/api/orgs/1/users/%d", 1),
			method:       http.MethodPatch,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "Editor"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can invite a user as a viewer in his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			role:         org.RoleViewer,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "newUserEmail@test.com", "sendEmail": false, "role": "Viewer"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot invite a user as an editor in his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			role:         org.RoleEditor,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionUsersCreate}},
			input:        `{"loginOrEmail": "newUserEmail@test.com", "sendEmail": false, "role": "Editor"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{}
				hs.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						AuthModule: "",
					},
				}
				hs.userService = &usertest.FakeUserService{
					ExpectedUser:         &user.User{},
					ExpectedSignedInUser: userWithPermissions(1, tt.permissions),
				}
				hs.accesscontrolService = &actest.FakeService{}
			})

			u := userWithPermissions(1, tt.permissions)
			var reader io.Reader
			if tt.input != "" {
				reader = strings.NewReader(tt.input)
			}

			res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewRequest(tt.method, tt.url, reader), u))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestPatchOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	type testCase struct {
		name         string
		role         org.RoleType
		permissions  []accesscontrol.Permission
		input        string
		expectedCode int
	}

	tests := []testCase{
		{
			name:         "user with permissions can update org role",
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"}},
			role:         org.RoleAdmin,
			input:        `{"role": "Viewer"}`,
			expectedCode: http.StatusOK,
		},
		{
			name:         "user without permissions cannot update org role",
			permissions:  []accesscontrol.Permission{},
			input:        `{"role": "Editor"}`,
			expectedCode: http.StatusForbidden,
		},
		{
			name:         "user with permissions cannot update org role with more privileges",
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"}},
			role:         org.RoleViewer,
			input:        `{"role": "Admin"}`,
			expectedCode: http.StatusForbidden,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.orgService = &orgtest.FakeOrgService{}
				hs.authInfoService = &authinfotest.FakeService{
					ExpectedUserAuth: &login.UserAuth{
						AuthModule: "",
					},
				}
				hs.accesscontrolService = &actest.FakeService{}
				hs.userService = &usertest.FakeUserService{
					ExpectedUser:         &user.User{},
					ExpectedSignedInUser: userWithPermissions(1, tt.permissions),
				}
			})

			u := userWithPermissions(1, tt.permissions)
			res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodPatch, "/api/orgs/1/users/1", strings.NewReader(tt.input)), u))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestDeleteOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	type testCase struct {
		name           string
		permissions    []accesscontrol.Permission
		isGrafanaAdmin bool
		expectedCode   int
	}

	tests := []testCase{
		{
			name: "user with permissions can remove user from org",
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionOrgUsersRemove, Scope: "users:*"},
			},
			expectedCode: http.StatusOK,
		},
		{
			name:         "user without permissions cannot remove user from org",
			expectedCode: http.StatusForbidden,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.accesscontrolService = actest.FakeService{}
				hs.orgService = &orgtest.FakeOrgService{
					ExpectedOrgListResponse: orgtest.OrgListResponse{struct {
						OrgID    int64
						Response error
					}{OrgID: 1, Response: nil}},
				}
				hs.authInfoService = &authinfotest.FakeService{}
				hs.userService = &usertest.FakeUserService{
					ExpectedUser:         &user.User{},
					ExpectedSignedInUser: userWithPermissions(1, tt.permissions),
				}
			})

			u := userWithPermissions(1, tt.permissions)
			u.IsGrafanaAdmin = tt.isGrafanaAdmin
			res, err := server.SendJSON(webtest.RequestWithSignedInUser(server.NewRequest(http.MethodDelete, "/api/orgs/1/users/1", nil), u))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}
