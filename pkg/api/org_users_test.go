package api

import (
	"context"
	"encoding/json"
	"errors"
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
	"github.com/stretchr/testify/mock"
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
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
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
	orgService, err := orgimpl.ProvideService(legacysql.NewDatabaseProvider(sqlStore), cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(
		legacysql.NewDatabaseProvider(sqlStore), orgService, cfg, nil, nil, tracing.InitializeTracerForTest(),
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

	sqlStore := db.InitTestDB(t, sqlstore.InitTestDBOpt{Cfg: settings}) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
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

// searchHitsWithModules builds n hits, assigning auth modules round-robin so
// each module appears across the whole range (and across pages).
func searchHitsWithModules(n int, startID int64, modules ...string) []*user.UserSearchHitDTO {
	out := searchHits(n, startID)
	for i, h := range out {
		h.AuthModule = user.AuthModuleConversion{modules[i%len(modules)]}
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
				ExpectedUser:        &user.User{ID: 42, UID: "uid-one", OrgID: 1},
			},
			authInfoService: &authinfotest.FakeService{},
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
		hs := &HTTPServer{Cfg: setting.NewCfg(), userService: svc, authInfoService: &authinfotest.FakeService{}}

		res, err := hs.searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1})
		require.NoError(t, err)
		assert.Equal(t, 2, svc.calls, "should keep paging until all users are collected")
		require.Len(t, res.OrgUsers, 1500)
		assert.Equal(t, int64(1500), res.TotalCount)
	})

	t.Run("does not search when a UserID is requested", func(t *testing.T) {
		svc := &pagedUserService{
			FakeUserService: &usertest.FakeUserService{ExpectedUser: &user.User{ID: 5, OrgID: 1}},
			pages: []user.SearchUserQueryResult{
				{Users: searchHits(1000, 1), TotalCount: 1500, Page: 1, PerPage: 1000},
				{Users: searchHits(500, 1001), TotalCount: 1500, Page: 2, PerPage: 1000}, // must not be fetched
			},
		}
		hs := &HTTPServer{Cfg: setting.NewCfg(), userService: svc, authInfoService: &authinfotest.FakeService{}}

		res, err := hs.searchOrgUsersUsingK8s(reqCtx(), &org.SearchOrgUsersQuery{OrgID: 1, UserID: 5})
		require.NoError(t, err)
		assert.Zero(t, svc.calls, "an exact lookup must not search")
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

// The externally-synced check depends only on the auth module, so it is
// resolved once per module per request, not once per user or per page.
func TestSearchOrgUsersUsingK8s_ResolvesExternallySyncedPerModule(t *testing.T) {
	githubModule := login.GithubAuthModule
	gitlabModule := login.GitLabAuthModule

	svc := &countingAuthnService{
		FakeService: &authntest.FakeService{ExpectedClientConfig: &authntest.FakeSSOClientConfig{}},
	}
	// Two pages force the resolver to span more than one page; both modules
	// appear on each page.
	userSvc := &pagedUserService{
		FakeUserService: &usertest.FakeUserService{},
		pages: []user.SearchUserQueryResult{
			{Users: searchHitsWithModules(1000, 1, githubModule, gitlabModule), TotalCount: 1500, Page: 1, PerPage: 1000},
			{Users: searchHitsWithModules(500, 1001, githubModule, gitlabModule), TotalCount: 1500, Page: 2, PerPage: 1000},
		},
	}
	hs := &HTTPServer{Cfg: setting.NewCfg(), authnService: svc, userService: userSvc}
	reqCtx := &contextmodel.ReqContext{Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)}}

	res, err := hs.searchOrgUsersUsingK8s(reqCtx, &org.SearchOrgUsersQuery{OrgID: 1})
	require.NoError(t, err)
	require.Equal(t, 2, userSvc.calls, "both pages must be fetched")
	require.Len(t, res.OrgUsers, 1500)
	for _, u := range res.OrgUsers {
		assert.True(t, u.IsExternallySynced)
	}

	// Each module is resolved exactly once, regardless of user or page count.
	want := map[string]int{authn.ClientWithPrefix("github"): 1, authn.ClientWithPrefix("gitlab"): 1}
	assert.Equal(t, want, svc.enabledCalls)
	assert.Equal(t, want, svc.configCalls)
}

// Same invariant as the K8s path, for the legacy searchOrgUsersHelper loop.
func TestSearchOrgUsersHelper_ResolvesExternallySyncedPerModule(t *testing.T) {
	const userCount = 50
	modules := []string{login.GithubAuthModule, login.GitLabAuthModule}

	users := make([]*org.OrgUserDTO, userCount)
	labels := make(map[int64]string, userCount)
	for i := range users {
		id := int64(i + 1)
		users[i] = &org.OrgUserDTO{UserID: id, Login: fmt.Sprintf("user-%d", id)}
		labels[id] = modules[i%len(modules)]
	}

	svc := &countingAuthnService{
		FakeService: &authntest.FakeService{ExpectedClientConfig: &authntest.FakeSSOClientConfig{}},
	}
	hs := &HTTPServer{
		Cfg:          setting.NewCfg(),
		authnService: svc,
		orgService: &orgtest.FakeOrgService{
			ExpectedSearchOrgUsersResult: &org.SearchOrgUsersQueryResult{OrgUsers: users, TotalCount: userCount},
		},
		authInfoService: &authinfotest.FakeService{ExpectedRecentlyUsedLabel: labels},
	}
	reqCtx := &contextmodel.ReqContext{Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/", nil)}}

	res, err := hs.searchOrgUsersHelper(reqCtx, &org.SearchOrgUsersQuery{OrgID: 1})
	require.NoError(t, err)
	require.Len(t, res.OrgUsers, userCount)
	for _, u := range res.OrgUsers {
		assert.True(t, u.IsExternallySynced)
	}

	// Each module is resolved exactly once, regardless of user count.
	want := map[string]int{authn.ClientWithPrefix("github"): 1, authn.ClientWithPrefix("gitlab"): 1}
	assert.Equal(t, want, svc.enabledCalls)
	assert.Equal(t, want, svc.configCalls)
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

func TestGetOrgUsersForCurrentOrg_UserID(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, false)
	for _, value := range []string{"42", "0", "-1", "invalid"} {
		t.Run(value, func(t *testing.T) {
			called := false
			hs := &HTTPServer{
				Cfg:             setting.NewCfg(),
				authInfoService: &authinfotest.FakeService{},
				orgService: &orgtest.FakeOrgService{SearchOrgUsersFn: func(_ context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
					called = true
					require.Equal(t, int64(42), query.UserID)
					require.Equal(t, int64(7), query.OrgID)
					require.True(t, query.ExcludeHiddenUsers)
					return &org.SearchOrgUsersQueryResult{OrgUsers: []*org.OrgUserDTO{{UserID: 42, UID: "target"}}}, nil
				}},
			}
			ctx := &contextmodel.ReqContext{
				Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users?userId="+value, nil)},
				SignedInUser: &user.SignedInUser{OrgID: 7, UserID: 1},
			}
			resp := hs.GetOrgUsersForCurrentOrg(ctx).(*response.NormalResponse)
			if value == "42" {
				require.Equal(t, http.StatusOK, resp.Status())
				require.True(t, called)
			} else {
				require.Equal(t, http.StatusBadRequest, resp.Status())
				require.False(t, called)
			}
		})
	}
}

func TestGetOrgUsersForCurrentOrg_ExactRedirectLookup(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
	for _, parameter := range []string{"userUid=target", "userId=1001"} {
		t.Run(parameter, func(t *testing.T) {
			service := &usertest.MockService{}
			u := &user.User{ID: 1001, UID: "target", OrgID: 7, OrgRole: "Editor", IsProvisioned: true, ExternalAuthInfo: []user.ExternalAuthInfo{{Module: login.LDAPAuthModule}}}
			if strings.HasPrefix(parameter, "userUid") {
				service.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "target"}).Return(u, nil).Once()
			} else {
				service.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 1001}).Return(u, nil).Once()
			}

			hs := &HTTPServer{Cfg: setting.NewCfg(), userService: service}
			hs.Cfg.LDAPAuthEnabled = true
			ctx := &contextmodel.ReqContext{
				Context: &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users?"+parameter+"&accesscontrol=true", nil)},
				SignedInUser: &user.SignedInUser{OrgID: 7, UserID: 1, Permissions: map[int64]map[string][]string{7: {
					"org.users:write": {"users:id:1001"}, "org.users:remove": {"users:uid:other"},
					"users.roles:read": {"users:uid:target"},
				}}},
			}
			resp := hs.GetOrgUsersForCurrentOrg(ctx).(*response.NormalResponse)
			require.Equal(t, http.StatusOK, resp.Status())
			var result []org.OrgUserDTO
			require.NoError(t, json.Unmarshal(resp.Body(), &result))
			require.Len(t, result, 1)
			require.Equal(t, "target", result[0].UID)
			require.Equal(t, "Editor", result[0].Role)
			require.True(t, result[0].IsProvisioned)
			require.True(t, result[0].IsExternallySynced)
			require.True(t, result[0].AccessControl["org.users:write"])
			require.True(t, result[0].AccessControl["users.roles:read"])
			require.False(t, result[0].AccessControl["org.users:remove"])
			service.AssertExpectations(t)
		})
	}
}

func TestOrgUserSearchIgnoresUIDOnOtherEndpoints(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
	service := &usertest.FakeUserService{
		ExpectedUser: &user.User{ID: 3, UID: "viewer", OrgID: 1, OrgRole: "Viewer"},
		ExpectedSearchUsers: user.SearchUserQueryResult{Users: []*user.UserSearchHitDTO{
			{ID: 1, Role: "Admin"}, {ID: 2, Role: "Admin"},
		}, TotalCount: 2, Page: 1, PerPage: 10},
	}
	hs := &HTTPServer{Cfg: setting.NewCfg(), userService: service, authInfoService: &authinfotest.FakeService{}}
	t.Run("last admin guard", func(t *testing.T) {
		ctx := &contextmodel.ReqContext{
			Context:      &web.Context{Req: httptest.NewRequest(http.MethodPatch, "/api/org/users/1?userUid=viewer", nil)},
			SignedInUser: &user.SignedInUser{OrgID: 1, UserID: 1},
		}
		other, err := hs.orgHasOtherAdmin(ctx, 1, 1)
		require.NoError(t, err)
		require.True(t, other)
	})
	t.Run("paged search", func(t *testing.T) {
		ctx := &contextmodel.ReqContext{
			Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users/search?userUid=viewer&page=1&perpage=10", nil)},
			SignedInUser: &user.SignedInUser{OrgID: 1, UserID: 1},
		}
		resp := hs.SearchOrgUsersWithPaging(ctx).(*response.NormalResponse)
		require.Equal(t, http.StatusOK, resp.Status())
		var result org.SearchOrgUsersQueryResult
		require.NoError(t, json.Unmarshal(resp.Body(), &result))
		require.Len(t, result.OrgUsers, 2)
		require.Equal(t, 1, result.Page)
		require.Equal(t, 10, result.PerPage)
	})
}

func TestGetOrgUsersForCurrentOrg_UIDLegacy(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, false)
	service := &usertest.MockService{}
	hs := &HTTPServer{
		Cfg: setting.NewCfg(), userService: service, authInfoService: &authinfotest.FakeService{},
		orgService: &orgtest.FakeOrgService{SearchOrgUsersFn: func(_ context.Context, query *org.SearchOrgUsersQuery) (*org.SearchOrgUsersQueryResult, error) {
			require.Zero(t, query.UserID)
			require.Equal(t, "target", query.UserUID)
			require.Equal(t, int64(7), query.OrgID)
			require.True(t, query.ExcludeHiddenUsers)
			return &org.SearchOrgUsersQueryResult{OrgUsers: []*org.OrgUserDTO{}}, nil
		}},
	}
	ctx := &contextmodel.ReqContext{
		Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users?userUid=target", nil)},
		SignedInUser: &user.SignedInUser{OrgID: 7, UserID: 1},
	}
	resp := hs.GetOrgUsersForCurrentOrg(ctx).(*response.NormalResponse)
	require.Equal(t, http.StatusOK, resp.Status())
	require.JSONEq(t, "[]", string(resp.Body()))
	service.AssertExpectations(t)
}

func TestGetOrgUsersForCurrentOrg_UIDAuthFallback(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
	for _, lookupErr := range []error{nil, errors.New("auth lookup unavailable")} {
		t.Run(fmt.Sprint(lookupErr), func(t *testing.T) {
			auth := &authinfotest.MockAuthInfoService{}
			auth.On("GetUsersRecentlyUsedLabel", mock.Anything, login.GetUserLabelsQuery{UserIDs: []int64{42}}).
				Return(map[int64]string{42: login.LDAPAuthModule}, lookupErr).Once()
			hs := &HTTPServer{Cfg: setting.NewCfg(), authInfoService: auth,
				userService: &usertest.FakeUserService{ExpectedUser: &user.User{ID: 42, UID: "target", OrgID: 7}},
			}
			hs.Cfg.LDAPAuthEnabled = true
			ctx := &contextmodel.ReqContext{
				Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users?userUid=target", nil)},
				SignedInUser: &user.SignedInUser{OrgID: 7, UserID: 1},
			}
			resp := hs.GetOrgUsersForCurrentOrg(ctx).(*response.NormalResponse)
			if lookupErr != nil {
				require.Equal(t, http.StatusInternalServerError, resp.Status())
			} else {
				require.Equal(t, http.StatusOK, resp.Status())
				var result []org.OrgUserDTO
				require.NoError(t, json.Unmarshal(resp.Body(), &result))
				require.Len(t, result, 1)
				require.True(t, result[0].IsExternallySynced)
			}
			auth.AssertExpectations(t)
		})
	}
}

func TestGetOrgUsersForCurrentOrg_ExactLookupHiddenUsers(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
	for _, lookup := range []string{"userUid=target", "userId=42"} {
		for _, tc := range []struct {
			name      string
			login     string
			admin     bool
			hidden    bool
			wantCount int
		}{
			{name: "hidden user excluded", login: "reader", hidden: true},
			{name: "hidden user sees self", login: "target", hidden: true, wantCount: 1},
			{name: "server admin sees hidden user", login: "reader", admin: true, hidden: true, wantCount: 1},
			{name: "visible user included", login: "reader", wantCount: 1},
		} {
			t.Run(lookup+"/"+tc.name, func(t *testing.T) {
				cfg := setting.NewCfg()
				if tc.hidden {
					cfg.HiddenUsers = map[string]struct{}{"target": {}}
				}
				hs := &HTTPServer{
					Cfg: cfg, authInfoService: &authinfotest.FakeService{},
					userService: &usertest.FakeUserService{ExpectedUser: &user.User{
						ID: 42, UID: "target", Login: "target", OrgID: 7, OrgRole: "Viewer",
					}},
				}
				ctx := &contextmodel.ReqContext{
					Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users?"+lookup, nil)},
					SignedInUser: &user.SignedInUser{OrgID: 7, UserID: 1, Login: tc.login, IsGrafanaAdmin: tc.admin},
				}
				resp := hs.GetOrgUsersForCurrentOrg(ctx).(*response.NormalResponse)
				require.Equal(t, http.StatusOK, resp.Status())
				var result []org.OrgUserDTO
				require.NoError(t, json.Unmarshal(resp.Body(), &result))
				require.Len(t, result, tc.wantCount)
				if tc.wantCount > 0 {
					require.Equal(t, "target", result[0].UID)
				}
			})
		}
	}
}

func TestGetOrgUsersForCurrentOrg_UIDRedirectErrors(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
	for _, tc := range []struct {
		name   string
		user   *user.User
		err    error
		status int
	}{
		{name: "missing", err: user.ErrUserNotFound, status: http.StatusOK},
		{name: "lookup failure", err: errors.New("unavailable"), status: http.StatusInternalServerError},
		{name: "other organization", user: &user.User{ID: 42, OrgID: 99}, status: http.StatusOK},
		{name: "service account", user: &user.User{ID: 42, OrgID: 7, IsServiceAccount: true}, status: http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			service := &usertest.MockService{}
			service.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "target"}).Return(tc.user, tc.err).Once()
			hs := &HTTPServer{Cfg: setting.NewCfg(), userService: service}
			ctx := &contextmodel.ReqContext{
				Context:      &web.Context{Req: httptest.NewRequest(http.MethodGet, "/api/org/users?userUid=target", nil)},
				SignedInUser: &user.SignedInUser{OrgID: 7, UserID: 1},
			}
			resp := hs.GetOrgUsersForCurrentOrg(ctx).(*response.NormalResponse)
			require.Equal(t, tc.status, resp.Status())
			if tc.status == http.StatusOK {
				require.JSONEq(t, "[]", string(resp.Body()))
			}
			service.AssertExpectations(t)
		})
	}
}

type lookupUserService struct {
	usertest.FakeUserService
	search func(context.Context, *user.SearchUsersQuery) (*user.SearchUserQueryResult, error)
}

func (s *lookupUserService) Search(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
	return s.search(ctx, query)
}

func TestGetOrgUsersForCurrentOrgLookup_KubernetesUsersRedirect(t *testing.T) {
	for _, tt := range []struct {
		name            string
		enforce         bool
		admin           bool
		login           string
		limit           int
		wantSearchLimit int
		wantLogins      []string
	}{
		{name: "unlicensed lookup uses service identity and hides other hidden users", login: "caller", limit: 10, wantSearchLimit: 12, wantLogins: []string{"visible"}},
		{name: "licensed lookup keeps caller identity", enforce: true, login: "caller", limit: 10, wantSearchLimit: 10, wantLogins: []string{"visible"}},
		{name: "hidden callers can see themselves", login: "hidden-self", limit: 10, wantSearchLimit: 12, wantLogins: []string{"hidden-self", "visible"}},
		{name: "server admins can see hidden users", admin: true, login: "caller", limit: 10, wantSearchLimit: 10, wantLogins: []string{"hidden-self", "hidden-other", "visible"}},
		{name: "limited lookup fills page after hidden users", login: "caller", limit: 1, wantSearchLimit: 3, wantLogins: []string{"visible"}},
		{name: "limited hidden caller is trimmed", login: "hidden-self", limit: 1, wantSearchLimit: 3, wantLogins: []string{"hidden-self"}},
		{name: "limited admin includes hidden users", admin: true, login: "caller", limit: 1, wantSearchLimit: 1, wantLogins: []string{"hidden-self"}},
		{name: "zero limit uses one default search page", login: "caller", wantSearchLimit: 0, wantLogins: []string{"visible"}},
		{name: "negative limit uses one default search page", login: "caller", limit: -1, wantSearchLimit: -1, wantLogins: []string{"visible"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
			cfg := setting.NewCfg()
			cfg.RBAC.SingleOrganization = true
			cfg.HiddenUsers = map[string]struct{}{"hidden-self": {}, "hidden-other": {}}
			license := licensingtest.NewFakeLicensing()
			license.On("FeatureEnabled", "accesscontrol.enforcement").Return(tt.enforce).Once()
			t.Cleanup(func() { license.AssertExpectations(t) })
			caller := &user.SignedInUser{OrgID: 1, UserID: 42, Login: tt.login, IsGrafanaAdmin: tt.admin, Namespace: "org-1"}
			called := false
			svc := &lookupUserService{search: func(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
				called = true
				require.Equal(t, !tt.enforce, identity.IsServiceIdentity(ctx))
				requester, err := identity.GetRequester(ctx)
				require.NoError(t, err)
				require.Equal(t, caller.OrgID, requester.GetOrgID())
				require.Equal(t, caller.Namespace, requester.GetNamespace())
				if tt.enforce {
					require.Same(t, caller, requester)
				}
				require.Same(t, caller, query.SignedInUser)
				require.Equal(t, caller.OrgID, query.OrgID)
				require.Equal(t, "lookup", query.Query)
				require.Equal(t, tt.wantSearchLimit, query.Limit)
				users := []*user.UserSearchHitDTO{
					{ID: 42, UID: "self", Login: "hidden-self"},
					{ID: 43, UID: "other", Login: "hidden-other"},
					{ID: 44, UID: "visible", Login: "visible"},
				}
				if query.Limit > 0 && query.Limit < len(users) {
					users = users[:query.Limit]
				}
				return &user.SearchUserQueryResult{Users: users, TotalCount: 3}, nil
			}}
			hs := &HTTPServer{Cfg: cfg, License: license, userService: svc}
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/org/users/lookup?query=lookup&limit=%d", tt.limit), nil)
			req = req.WithContext(identity.WithRequester(req.Context(), caller))
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: caller}
			resp := hs.GetOrgUsersForCurrentOrgLookup(ctx)
			require.True(t, called)
			normalResp, ok := resp.(*response.NormalResponse)
			require.True(t, ok)
			require.Equal(t, http.StatusOK, normalResp.Status())
			var got []dtos.UserLookupDTO
			require.NoError(t, json.Unmarshal(normalResp.Body(), &got))
			logins := make([]string, 0, len(got))
			for _, u := range got {
				logins = append(logins, u.Login)
			}
			require.ElementsMatch(t, tt.wantLogins, logins)
		})
	}
}

func TestGetOrgUsersForCurrentOrgLookup_KubernetesUsersRedirect_Pagination(t *testing.T) {
	for _, tt := range []struct {
		name        string
		limit       int
		userCount   int
		hiddenCount int
		failPage    int
		enforce     bool
		wantCount   int
		wantCalls   int
	}{
		{name: "oversized limit is capped", limit: 5000, userCount: 6000, wantCount: 1000, wantCalls: 1},
		{name: "oversized limit with hidden users is capped", limit: 5000, userCount: 6000, hiddenCount: 2, wantCount: 1000, wantCalls: 2},
		{name: "licensed lookup uses a single page", limit: 1000, userCount: 1002, hiddenCount: 2, enforce: true, wantCount: 998, wantCalls: 1},
		{name: "licensed lookup ignores totals that include filtered users", limit: 1000, userCount: 2000, hiddenCount: 1000, enforce: true, wantCalls: 1},
		{name: "maximum limit with hidden users", limit: 1000, userCount: 1002, hiddenCount: 2, wantCount: 1000, wantCalls: 2},
		{name: "near maximum trims second page", limit: 999, userCount: 1010, hiddenCount: 2, wantCount: 999, wantCalls: 2},
		{name: "short final page", limit: 1000, userCount: 1001, hiddenCount: 2, wantCount: 999, wantCalls: 2},
		{name: "full final page stops at total count", limit: 1000, userCount: 1000, hiddenCount: 2, wantCount: 998, wantCalls: 1},
		{name: "full visible page needs no more requests", limit: 1000, userCount: 1010, wantCount: 1000, wantCalls: 1},
		{name: "entire first page hidden", limit: 1000, userCount: 2000, hiddenCount: 1000, wantCount: 1000, wantCalls: 2},
		{name: "empty directory", limit: 1000, wantCalls: 1},
		{name: "second page error", limit: 1000, userCount: 1002, hiddenCount: 2, failPage: 2, wantCalls: 2},
	} {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)
			cfg := setting.NewCfg()
			cfg.RBAC.SingleOrganization = true
			cfg.HiddenUsers = make(map[string]struct{})
			users := searchHits(tt.userCount, 1)
			for _, u := range users[:tt.hiddenCount] {
				cfg.HiddenUsers[u.Login] = struct{}{}
			}
			license := licensingtest.NewFakeLicensing()
			license.On("FeatureEnabled", "accesscontrol.enforcement").Return(tt.enforce).Once()
			t.Cleanup(func() { license.AssertExpectations(t) })
			caller := &user.SignedInUser{OrgID: 1, Login: "caller", Namespace: "org-1"}
			calls := 0
			svc := &lookupUserService{search: func(ctx context.Context, query *user.SearchUsersQuery) (*user.SearchUserQueryResult, error) {
				calls++
				require.LessOrEqual(t, calls, tt.wantCalls)
				require.Equal(t, calls, query.Page)
				require.Equal(t, 1000, query.Limit)
				require.Equal(t, !tt.enforce, identity.IsServiceIdentity(ctx))
				if query.Page == tt.failPage {
					return nil, errors.New("search failed")
				}
				start := (query.Page - 1) * query.Limit
				end := min(start+query.Limit, len(users))
				pageUsers := users[start:end]
				// Searches as the caller can filter users after paging while still counting them.
				if tt.enforce {
					visible := make([]*user.UserSearchHitDTO, 0, len(pageUsers))
					for _, u := range pageUsers {
						if _, hidden := cfg.HiddenUsers[u.Login]; !hidden {
							visible = append(visible, u)
						}
					}
					pageUsers = visible
				}
				return &user.SearchUserQueryResult{Users: pageUsers, TotalCount: int64(len(users))}, nil
			}}
			hs := &HTTPServer{Cfg: cfg, License: license, userService: svc}
			req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/org/users/lookup?limit=%d", tt.limit), nil)
			req = req.WithContext(identity.WithRequester(req.Context(), caller))
			ctx := &contextmodel.ReqContext{Context: &web.Context{Req: req}, SignedInUser: caller}
			resp := hs.GetOrgUsersForCurrentOrgLookup(ctx)
			require.Equal(t, tt.wantCalls, calls)
			if tt.failPage > 0 {
				require.Equal(t, http.StatusInternalServerError, resp.Status())
				return
			}
			require.Equal(t, http.StatusOK, resp.Status())
			normalResp, ok := resp.(*response.NormalResponse)
			require.True(t, ok)
			var got []dtos.UserLookupDTO
			require.NoError(t, json.Unmarshal(normalResp.Body(), &got))
			require.Len(t, got, tt.wantCount)
			for i, u := range got {
				require.Equal(t, users[tt.hiddenCount+i].Login, u.Login)
			}
		})
	}
}

func TestUpdateOrgUserForCurrentOrg_KubernetesUsersRedirect(t *testing.T) {
	permissions := []accesscontrol.Permission{
		{Action: accesscontrol.ActionOrgUsersRead, Scope: "users:*"},
		{Action: accesscontrol.ActionOrgUsersWrite, Scope: "users:*"},
	}

	orgUsersWithTwoAdmins := user.SearchUserQueryResult{
		TotalCount: 2,
		Users: []*user.UserSearchHitDTO{
			{ID: 1, Login: "target", Role: string(identity.RoleAdmin)},
			{ID: 2, Login: "other", Role: string(identity.RoleAdmin)},
		},
	}

	type deps struct {
		updateCmd   *user.UpdateUserCommand
		legacyError error
		updateError error
		searchUsers user.SearchUserQueryResult
	}

	setup := func(t *testing.T, d *deps) *webtest.Server {
		return SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.authInfoService = &authinfotest.FakeService{
				ExpectedUserAuth: &login.UserAuth{AuthModule: ""},
			}
			hs.userService = &usertest.FakeUserService{
				ExpectedSearchUsers: d.searchUsers,
				UpdateFn: func(_ context.Context, cmd *user.UpdateUserCommand) error {
					d.updateCmd = cmd
					return d.updateError
				},
			}
			hs.orgService = &orgtest.FakeOrgService{ExpectedError: d.legacyError}
			hs.accesscontrolService = &actest.FakeService{ExpectedPermissions: permissions}
		})
	}

	sendPatch := func(t *testing.T, server *webtest.Server, role string) int {
		signedInUser := userWithPermissions(1, permissions)
		signedInUser.OrgRole = identity.RoleAdmin
		body := fmt.Sprintf(`{"role": %q}`, role)
		req := server.NewRequest(http.MethodPatch, "/api/org/users/1", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := server.Send(webtest.RequestWithSignedInUser(req, signedInUser))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
		return res.StatusCode
	}

	t.Run("routes the role update through the user service when the flag is enabled", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		// Force the legacy path to error so a 200 proves it was not taken.
		d := &deps{legacyError: errors.New("legacy path must not be called"), searchUsers: orgUsersWithTwoAdmins}
		statusCode := sendPatch(t, setup(t, d), "Editor")

		assert.Equal(t, http.StatusOK, statusCode)
		require.NotNil(t, d.updateCmd)
		assert.Equal(t, int64(1), d.updateCmd.UserID)
		require.NotNil(t, d.updateCmd.OrgRole)
		assert.Equal(t, string(identity.RoleEditor), *d.updateCmd.OrgRole)
	})

	t.Run("returns 500 when the user service update fails", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{updateError: errors.New("boom"), searchUsers: orgUsersWithTwoAdmins}
		statusCode := sendPatch(t, setup(t, d), "Editor")

		assert.Equal(t, http.StatusInternalServerError, statusCode)
	})

	t.Run("blocks demoting the last org admin", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{searchUsers: user.SearchUserQueryResult{
			TotalCount: 2,
			Users: []*user.UserSearchHitDTO{
				{ID: 1, Login: "target", Role: string(identity.RoleAdmin)},
				{ID: 2, Login: "other", Role: string(identity.RoleViewer)},
			},
		}}
		statusCode := sendPatch(t, setup(t, d), "Editor")

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Nil(t, d.updateCmd, "user service update should not be called when the change is blocked")
	})

	t.Run("allows promoting to Admin without the last-admin lookup", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{}
		statusCode := sendPatch(t, setup(t, d), "Admin")

		assert.Equal(t, http.StatusOK, statusCode)
		require.NotNil(t, d.updateCmd)
		assert.Equal(t, string(identity.RoleAdmin), *d.updateCmd.OrgRole)
	})

	t.Run("keeps using the legacy org service when the flag is disabled", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, false)

		d := &deps{}
		statusCode := sendPatch(t, setup(t, d), "Editor")

		assert.Equal(t, http.StatusOK, statusCode)
		assert.Nil(t, d.updateCmd, "user service update should not be called on the legacy path")
	})
}

func TestRemoveOrgUserForCurrentOrg_KubernetesUsersRedirect(t *testing.T) {
	permissions := []accesscontrol.Permission{
		{Action: accesscontrol.ActionOrgUsersRead, Scope: "users:*"},
		{Action: accesscontrol.ActionOrgUsersRemove, Scope: "users:*"},
	}

	orgUsersWithTwoAdmins := user.SearchUserQueryResult{
		TotalCount: 2,
		Users: []*user.UserSearchHitDTO{
			{ID: 1, Login: "target", Role: string(identity.RoleAdmin)},
			{ID: 2, Login: "other", Role: string(identity.RoleAdmin)},
		},
	}

	type deps struct {
		deleteCmd       *user.DeleteUserCommand
		orgListResponse orgtest.OrgListResponse
		deleteError     error
		searchUsers     user.SearchUserQueryResult
		singleOrg       bool
		targetUser      *user.User
	}

	setup := func(t *testing.T, d *deps) *webtest.Server {
		targetUser := d.targetUser
		if targetUser == nil {
			targetUser = &user.User{ID: 1, IsAdmin: false}
		}
		return SetupAPITestServer(t, func(hs *HTTPServer) {
			hs.Cfg = setting.NewCfg()
			hs.Cfg.RBAC.SingleOrganization = d.singleOrg
			hs.userService = &usertest.FakeUserService{
				ExpectedUser:        targetUser,
				ExpectedSearchUsers: d.searchUsers,
				DeleteFn: func(_ context.Context, cmd *user.DeleteUserCommand) error {
					d.deleteCmd = cmd
					return d.deleteError
				},
			}
			hs.orgService = &orgtest.FakeOrgService{ExpectedOrgListResponse: d.orgListResponse}
			hs.accesscontrolService = &actest.FakeService{ExpectedPermissions: permissions}
		})
	}

	sendDelete := func(t *testing.T, server *webtest.Server) int {
		signedInUser := userWithPermissions(1, permissions)
		signedInUser.OrgRole = identity.RoleAdmin
		req := server.NewRequest(http.MethodDelete, "/api/org/users/1", nil)
		res, err := server.Send(webtest.RequestWithSignedInUser(req, signedInUser))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
		return res.StatusCode
	}

	t.Run("routes the removal through the user service when the flag is enabled and single-org", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{searchUsers: orgUsersWithTwoAdmins, singleOrg: true}
		statusCode := sendDelete(t, setup(t, d))

		assert.Equal(t, http.StatusOK, statusCode)
		require.NotNil(t, d.deleteCmd)
		assert.Equal(t, int64(1), d.deleteCmd.UserID)
	})

	t.Run("returns 500 when the user service delete fails", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{deleteError: errors.New("boom"), searchUsers: orgUsersWithTwoAdmins, singleOrg: true}
		statusCode := sendDelete(t, setup(t, d))

		assert.Equal(t, http.StatusInternalServerError, statusCode)
	})

	t.Run("blocks removing the last org admin", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{singleOrg: true, searchUsers: user.SearchUserQueryResult{
			TotalCount: 2,
			Users: []*user.UserSearchHitDTO{
				{ID: 1, Login: "target", Role: string(identity.RoleAdmin)},
				{ID: 2, Login: "other", Role: string(identity.RoleViewer)},
			},
		}}
		statusCode := sendDelete(t, setup(t, d))

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Nil(t, d.deleteCmd, "user service delete should not be called when the removal is blocked")
	})

	t.Run("blocks removing a Grafana server admin from their only org", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{singleOrg: true, searchUsers: orgUsersWithTwoAdmins, targetUser: &user.User{ID: 1, IsAdmin: true}}
		statusCode := sendDelete(t, setup(t, d))

		assert.Equal(t, http.StatusBadRequest, statusCode)
		assert.Nil(t, d.deleteCmd, "user service delete should not be called for a Grafana server admin")
	})

	t.Run("keeps using the legacy org service when not single-org", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, true)

		d := &deps{searchUsers: orgUsersWithTwoAdmins, singleOrg: false, orgListResponse: orgtest.OrgListResponse{{OrgID: 1, Response: nil}}}
		statusCode := sendDelete(t, setup(t, d))

		assert.Equal(t, http.StatusOK, statusCode)
		assert.Nil(t, d.deleteCmd, "user service delete should not be called on the legacy path")
	})

	t.Run("keeps using the legacy org service when the flag is disabled", func(t *testing.T) {
		setupOpenFeatureFlag(t, featuremgmt.FlagKubernetesUsersRedirect, false)

		d := &deps{searchUsers: orgUsersWithTwoAdmins, singleOrg: true, orgListResponse: orgtest.OrgListResponse{{OrgID: 1, Response: nil}}}
		statusCode := sendDelete(t, setup(t, d))

		assert.Equal(t, http.StatusOK, statusCode)
		assert.Nil(t, d.deleteCmd, "user service delete should not be called on the legacy path")
	})
}
