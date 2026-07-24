package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func setUpGetOrgUsersDB(t *testing.T, sqlStore db.DB, cfg *setting.Cfg) {
	cfg.AutoAssignOrg = true
	cfg.AutoAssignOrgId = int(testOrgID)

	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), legacysql.NewDatabaseProvider(sqlStore), cfgProvider)
	orgService, err := orgimpl.ProvideService(sqlStore, cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		sqlStore, orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
		quotaService, supportbundlestest.NewFakeBundleService(), nil,
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
	testutil.SkipIntegrationTestInShortMode(t)

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
					{Login: "user2", Email: "user2@grafana.com"},
				},
			}

			orgService.SearchOrgUsersFn = func(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
				require.True(t, query.ExcludeHiddenUsers)
				return orgService.ExpectedSearchOrgUsersResult, nil
			}
			defer func() { orgService.SearchOrgUsersFn = nil }()

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
				orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{
					OrgUsers: []*org.OrgUserDTO{
						{Login: testUserLogin, Email: "testUser@grafana.com"},
						{Login: "user2", Email: "user2@grafana.com"},
					},
				}
				orgService.SearchOrgUsersFn = func(ctx context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
					require.True(t, query.ExcludeHiddenUsers)
					return orgService.ExpectedSearchOrgUsersResult, nil
				}
				defer func() { orgService.SearchOrgUsersFn = nil }()

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

type pagedUserService struct {
	*usertest.FakeUserService
	pages []user.SearchUserQueryResult
	calls int
}

func (s *pagedUserService) Search(context.Context, *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	r := s.pages[s.calls]
	s.calls++
	return &r, nil
}

func searchHits(n int, startID int64) []*user.UserSearchHitDTO {
	out := make([]*user.UserSearchHitDTO, n)
	for i := range out {
		id := startID + int64(i)
		out[i] = &user.UserSearchHitDTO{ID: id, UID: fmt.Sprintf("uid-%d", id), Login: fmt.Sprintf("user-%d", id)}
	}
	return out
}

func TestSearchOrgUsersUsingK8s(t *testing.T) {
	created := time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC)
	lastSeen := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)

	hits := []*user.UserSearchHitDTO{
		{
			ID:            42,
			UID:           "uid-one",
			Name:          "John Doe",
			Login:         "jdoe",
			Email:         "jdoe@example.com",
			Role:          "Admin",
			AccessControl: map[string]bool{"org.users:write": true},
			LastSeenAt:    lastSeen,
			LastSeenAtAge: "5 days",
			Created:       created,
			IsDisabled:    true,
			IsProvisioned: true,
			AuthModule:    user.AuthModuleConversion{login.LDAPAuthModule},
		},
		{ID: 99, UID: "uid-two", Login: "other", Role: "Viewer"},
	}

	newHS := func() *HTTPServer {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true
		return &HTTPServer{
			Cfg: cfg,
			userService: &usertest.FakeUserService{
				ExpectedSearchUsers: user.SearchUserQueryResult{TotalCount: 2, Users: hits, Page: 1, PerPage: 50},
			},
		}
	}
	reqCtx := func() *contextmodel.ReqContext {
		return &contextmodel.ReqContext{Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)}}
	}

	t.Run("maps user search hits to org users", func(t *testing.T) {
		res, err := newHS().searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1})
		require.NoError(t, err)
		require.Len(t, res.OrgUsers, 2)
		assert.Equal(t, int64(2), res.TotalCount)

		got := res.OrgUsers[0]
		assert.Equal(t, int64(1), got.OrgID)
		assert.Equal(t, int64(42), got.UserID)
		assert.Equal(t, "uid-one", got.UID)
		assert.Equal(t, "jdoe", got.Login)
		assert.Equal(t, "jdoe@example.com", got.Email)
		assert.Equal(t, "John Doe", got.Name)
		assert.Equal(t, "Admin", got.Role)
		assert.Equal(t, lastSeen, got.LastSeenAt)
		assert.Equal(t, "5 days", got.LastSeenAtAge)
		assert.Equal(t, created, got.Created)
		assert.True(t, got.IsDisabled)
		assert.True(t, got.IsProvisioned)
		assert.Equal(t, map[string]bool{"org.users:write": true}, got.AccessControl)
		assert.NotEmpty(t, got.AvatarURL)
		assert.Equal(t, []string{login.LDAPLabel}, got.AuthLabels)
		assert.True(t, got.IsExternallySynced)

		// A user without auth modules has no labels and is not externally synced.
		other := res.OrgUsers[1]
		assert.Empty(t, other.AuthLabels)
		assert.False(t, other.IsExternallySynced)
	})

	t.Run("filters by UserID and adjusts total", func(t *testing.T) {
		res, err := newHS().searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1, UserID: 42})
		require.NoError(t, err)
		require.Len(t, res.OrgUsers, 1)
		assert.Equal(t, int64(42), res.OrgUsers[0].UserID)
		assert.Equal(t, int64(1), res.TotalCount)
	})

	// With no limit (GetOrgUsersForCurrentOrg), all users must be returned even
	// when they span multiple search pages, rather than being truncated.
	t.Run("pages through all users when no limit is requested", func(t *testing.T) {
		svc := &pagedUserService{
			FakeUserService: &usertest.FakeUserService{},
			pages: []user.SearchUserQueryResult{
				{Users: searchHits(1000, 1), TotalCount: 1500, Page: 1, PerPage: 1000},
				{Users: searchHits(500, 1001), TotalCount: 1500, Page: 2, PerPage: 1000},
			},
		}
		hs := &HTTPServer{Cfg: setting.NewCfg(), userService: svc}

		res, err := hs.searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, 2, svc.calls, "should keep paging until all users are collected")
		require.Len(t, res.OrgUsers, 1500)
		assert.Equal(t, int64(1500), res.TotalCount)
	})

	// A UserID lookup is a single-page request, not a paged sweep.
	t.Run("fetches a single page when a UserID is requested", func(t *testing.T) {
		svc := &pagedUserService{
			FakeUserService: &usertest.FakeUserService{},
			pages: []user.SearchUserQueryResult{
				{Users: searchHits(1000, 1), TotalCount: 1500, Page: 1, PerPage: 1000},
				{Users: searchHits(500, 1001), TotalCount: 1500, Page: 2, PerPage: 1000}, // must not be fetched
			},
		}
		hs := &HTTPServer{Cfg: setting.NewCfg(), userService: svc}

		res, err := hs.searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1, UserID: 5})
		require.NoError(t, err)
		assert.Equal(t, 1, svc.calls, "a UserID lookup must not page through all results")
		require.Len(t, res.OrgUsers, 1)
		assert.Equal(t, int64(5), res.OrgUsers[0].UserID)
	})

	// An explicit limit means a paged request, so only that single page is fetched.
	t.Run("fetches a single page when an explicit limit is requested", func(t *testing.T) {
		svc := &pagedUserService{
			FakeUserService: &usertest.FakeUserService{},
			pages: []user.SearchUserQueryResult{
				{Users: searchHits(50, 1), TotalCount: 1500, Page: 1, PerPage: 50},
				{Users: searchHits(50, 51), TotalCount: 1500, Page: 2, PerPage: 50}, // must not be fetched
			},
		}
		hs := &HTTPServer{Cfg: setting.NewCfg(), userService: svc}

		res, err := hs.searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1, Limit: 50, Page: 1})
		require.NoError(t, err)
		assert.Equal(t, 1, svc.calls, "explicit limit must fetch exactly one page")
		require.Len(t, res.OrgUsers, 50)
	})
}

func TestGetOrgUsersForCurrentOrg_KubernetesUsersRedirect(t *testing.T) {
	hits := []*user.UserSearchHitDTO{
		{ID: 42, UID: "uid-one", Login: "jdoe", Email: "jdoe@example.com", Role: "Admin"},
		{ID: 99, UID: "uid-two", Login: "other", Role: "Viewer"},
	}
	newHS := func() *HTTPServer {
		return &HTTPServer{
			Cfg: setting.NewCfg(),
			userService: &usertest.FakeUserService{
				ExpectedSearchUsers: user.SearchUserQueryResult{TotalCount: 2, Users: hits, Page: 1, PerPage: 1000},
			},
		}
	}
	reqCtx := func() *contextmodel.ReqContext {
		return &contextmodel.ReqContext{
			Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)},
			SignedInUser: &user.SignedInUser{OrgID: 1, UserID: 1},
		}
	}

	t.Run("reads users from the user service when kubernetesUsersRedirect is enabled", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		resp := newHS().GetOrgUsersForCurrentOrg(reqCtx())
		normalResp, ok := resp.(*response.NormalResponse)
		require.True(t, ok)
		require.Equal(t, http.StatusOK, normalResp.Status())

		var got []org.OrgUserDTO
		require.NoError(t, json.Unmarshal(normalResp.Body(), &got))
		require.Len(t, got, 2)
		assert.Equal(t, "jdoe", got[0].Login)
		assert.Equal(t, int64(42), got[0].UserID)
		assert.Equal(t, "other", got[1].Login)
	})
}
