package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/logintest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/temp_user/tempuserimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func setUpGetOrgUsersDB(t *testing.T, sqlStore *sqlstore.SQLStore) {
	sqlStore.Cfg.AutoAssignOrg = true
	sqlStore.Cfg.AutoAssignOrgId = int(testOrgID)

	quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService)
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

func TestOrgUsersAPIEndpoint_userLoggedIn(t *testing.T) {
	hs := setupSimpleHTTPServer(featuremgmt.WithFeatures())
	settings := hs.Cfg

	sqlStore := db.InitTestDB(t)
	sqlStore.Cfg = settings
	hs.SQLStore = sqlStore
	orgService := orgtest.NewOrgServiceFake()
	orgService.ExpectedSearchOrgUsersResult = &org.SearchOrgUsersQueryResult{}
	hs.orgService = orgService
	mock := dbtest.NewFakeDB()

	loggedInUserScenario(t, "When calling GET on", "api/org/users", "api/org/users", func(sc *scenarioContext) {
		setUpGetOrgUsersDB(t, sqlStore)
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
		setUpGetOrgUsersDB(t, sqlStore)

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
		setUpGetOrgUsersDB(t, sqlStore)

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
			setUpGetOrgUsersDB(t, sqlStore)
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
				setUpGetOrgUsersDB(t, sqlStore)

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
			desc:            "should not be able to change basicRole with a different provider",
			SkipOrgRoleSync: false,
			AuthEnabled:     true,
			AuthModule:      login.GenericOAuthModule,
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
				if tt.AuthModule == login.LDAPAuthModule {
					hs.Cfg.LDAPAuthEnabled = tt.AuthEnabled
					hs.Cfg.LDAPSkipOrgRoleSync = tt.SkipOrgRoleSync
				} else if tt.AuthModule == login.GenericOAuthModule {
					hs.Cfg.GenericOAuthAuthEnabled = tt.AuthEnabled
					hs.Cfg.GenericOAuthSkipOrgRoleSync = tt.SkipOrgRoleSync
				} else if tt.AuthModule == "" {
					// authmodule empty means basic auth
				} else {
					t.Errorf("invalid auth module for test: %s", tt.AuthModule)
				}

				hs.authInfoService = &logintest.AuthInfoServiceFake{
					ExpectedUserAuth: &login.UserAuth{AuthModule: tt.AuthModule},
				}
				hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagOnlyExternalOrgRoleSync, true)
				hs.userService = &usertest.FakeUserService{ExpectedSignedInUser: userWithPermissions}
				hs.orgService = &orgtest.FakeOrgService{}
				hs.accesscontrolService = &actest.FakeService{
					ExpectedPermissions: permissions,
				}
			})
			req := server.NewRequest(http.MethodPatch, fmt.Sprintf("/api/orgs/%d/users/%d", userRequesting.OrgID, userRequesting.ID), strings.NewReader(reqBody))
			req.Header.Set("Content-Type", "application/json")
			userWithPermissions.OrgRole = roletype.RoleAdmin
			res, err := server.Send(webtest.RequestWithSignedInUser(req, userWithPermissions))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_FolderAdmin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create a dashboard folder
	cmd := dashboards.SaveDashboardCommand{
		OrgID:    testOrgID,
		FolderID: 1,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "1 test dash folder",
			"tags":  "prod",
		}),
	}
	folder, err := sc.dashboardsStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)
	require.NotNil(t, folder)

	// Grant our test Viewer with permission to admin the folder
	acls := []*dashboards.DashboardACL{
		{
			DashboardID: folder.ID,
			OrgID:       testOrgID,
			UserID:      testUserID,
			Permission:  dashboards.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}
	err = sc.dashboardsStore.UpdateDashboardACL(context.Background(), folder.ID, acls)
	require.NoError(t, err)

	response := callAPI(sc.server, http.MethodGet, "/api/org/users/lookup", nil, t)
	assert.Equal(t, http.StatusOK, response.Code)
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_TeamAdmin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Setup store teams
	team1, err := sc.teamService.CreateTeam("testteam1", "testteam1@example.org", testOrgID)
	require.NoError(t, err)
	err = sc.teamService.AddTeamMember(testUserID, testOrgID, team1.ID, false, dashboards.PERMISSION_ADMIN)
	require.NoError(t, err)

	response := callAPI(sc.server, http.MethodGet, "/api/org/users/lookup", nil, t)
	assert.Equal(t, http.StatusOK, response.Code)
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_Admin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInOrgAdmin(sc.initCtx)

	response := callAPI(sc.server, http.MethodGet, "/api/org/users/lookup", nil, t)
	assert.Equal(t, http.StatusOK, response.Code)
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_Viewer(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	response := callAPI(sc.server, http.MethodGet, "/api/org/users/lookup", nil, t)
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	tests := []accessControlTestCase{
		{
			expectedCode: http.StatusOK,
			desc:         "UsersLookupGet should return 200 for user with correct permissions",
			url:          "/api/org/users/lookup",
			method:       http.MethodGet,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll}},
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "UsersLookupGet should return 403 for user without required permissions",
			url:          "/api/org/users/lookup",
			method:       http.MethodGet,
			permissions:  []accesscontrol.Permission{{Action: "wrong"}},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			sc := setupHTTPServer(t, true)
			setInitCtxSignedInViewer(sc.initCtx)
			setAccessControlPermissions(sc.acmock, test.permissions, sc.initCtx.OrgID)

			response := callAPI(sc.server, http.MethodGet, test.url, nil, t)
			assert.Equal(t, test.expectedCode, response.Code)
		})
	}
}

var (
	testServerAdminViewer = user.SignedInUser{
		UserID:         1,
		OrgID:          1,
		OrgName:        "TestOrg1",
		OrgRole:        org.RoleViewer,
		Login:          "testServerAdmin",
		Name:           "testServerAdmin",
		Email:          "testServerAdmin@example.org",
		OrgCount:       2,
		IsGrafanaAdmin: true,
		IsAnonymous:    false,
	}

	testAdminOrg2 = user.SignedInUser{
		UserID:         2,
		OrgID:          2,
		OrgName:        "TestOrg2",
		OrgRole:        org.RoleAdmin,
		Login:          "testAdmin",
		Name:           "testAdmin",
		Email:          "testAdmin@example.org",
		OrgCount:       1,
		IsGrafanaAdmin: false,
		IsAnonymous:    false,
	}

	testEditorOrg1 = user.SignedInUser{
		UserID:         3,
		OrgID:          1,
		OrgName:        "TestOrg1",
		OrgRole:        org.RoleEditor,
		Login:          "testEditor",
		Name:           "testEditor",
		Email:          "testEditor@example.org",
		OrgCount:       1,
		IsGrafanaAdmin: false,
		IsAnonymous:    false,
	}
)

// setupOrgUsersDBForAccessControlTests creates three users placed in two orgs
// Org1: testServerAdminViewer, testEditorOrg1
// Org2: testServerAdminViewer, testAdminOrg2
func setupOrgUsersDBForAccessControlTests(t *testing.T, db *sqlstore.SQLStore, orgService org.Service) {
	t.Helper()

	quotaService := quotaimpl.ProvideService(db, db.Cfg)
	usrSvc, err := userimpl.ProvideService(db, orgService, db.Cfg, nil, nil, quotaService)
	require.NoError(t, err)

	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Email: testServerAdminViewer.Email, SkipOrgSetup: true, Login: testServerAdminViewer.Login})
	require.NoError(t, err)
	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Email: testAdminOrg2.Email, SkipOrgSetup: true, Login: testAdminOrg2.Login})
	require.NoError(t, err)
	_, err = usrSvc.Create(context.Background(), &user.CreateUserCommand{Email: testEditorOrg1.Email, SkipOrgSetup: true, Login: testEditorOrg1.Login})
	require.NoError(t, err)

	// Create both orgs with server admin
	_, err = orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: testServerAdminViewer.OrgName, UserID: testServerAdminViewer.UserID})
	require.NoError(t, err)
	_, err = orgService.CreateWithMember(context.Background(), &org.CreateOrgCommand{Name: testAdminOrg2.OrgName, UserID: testServerAdminViewer.UserID})
	require.NoError(t, err)

	err = orgService.AddOrgUser(context.Background(), &org.AddOrgUserCommand{LoginOrEmail: testAdminOrg2.Login, Role: testAdminOrg2.OrgRole, OrgID: testAdminOrg2.OrgID, UserID: testAdminOrg2.UserID})
	require.NoError(t, err)
	err = orgService.AddOrgUser(context.Background(), &org.AddOrgUserCommand{LoginOrEmail: testEditorOrg1.Login, Role: testEditorOrg1.OrgRole, OrgID: testEditorOrg1.OrgID, UserID: testEditorOrg1.UserID})
	require.NoError(t, err)
}

func TestGetOrgUsersAPIEndpoint_AccessControlMetadata(t *testing.T) {
	url := "/api/orgs/%v/users?accesscontrol=true"
	type testCase struct {
		name                string
		enableAccessControl bool
		expectedCode        int
		expectedMetadata    map[string]bool
		user                user.SignedInUser
		targetOrg           int64
	}

	tests := []testCase{
		{
			name:                "access control metadata not requested",
			enableAccessControl: false,
			expectedCode:        http.StatusOK,
			expectedMetadata:    nil,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgID,
		},
		{
			name:                "access control metadata requested",
			enableAccessControl: true,
			expectedCode:        http.StatusOK,
			expectedMetadata: map[string]bool{
				"org.users:write":        true,
				"org.users:add":          true,
				"org.users:read":         true,
				"org.users:remove":       true,
				"users.permissions:read": true},
			user:      testServerAdminViewer,
			targetOrg: testServerAdminViewer.OrgID,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tc.enableAccessControl
			var err error
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.userService, err = userimpl.ProvideService(
					hs.SQLStore, nil, cfg, teamimpl.ProvideService(hs.SQLStore.(*sqlstore.SQLStore), cfg), localcache.ProvideService(), quotatest.New(false, nil))
				require.NoError(t, err)
				hs.orgService, err = orgimpl.ProvideService(hs.SQLStore, cfg, quotatest.New(false, nil))
				require.NoError(t, err)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db, sc.hs.orgService)
			setInitCtxSignedInUser(sc.initCtx, tc.user)

			// Perform test
			response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(url, tc.targetOrg), nil, t)
			require.Equal(t, tc.expectedCode, response.Code)

			var userList []*org.OrgUserDTO
			err = json.NewDecoder(response.Body).Decode(&userList)
			require.NoError(t, err)

			if tc.expectedMetadata != nil {
				assert.Equal(t, tc.expectedMetadata, userList[0].AccessControl)
			} else {
				assert.Nil(t, userList[0].AccessControl)
			}
		})
	}
}

func TestGetOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	url := "/api/orgs/%v/users/"
	type testCase struct {
		name                string
		enableAccessControl bool
		expectedCode        int
		expectedUserCount   int
		user                user.SignedInUser
		targetOrg           int64
	}

	tests := []testCase{
		{
			name:                "server admin can get users in his org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusOK,
			expectedUserCount:   2,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgID,
		},
		{
			name:                "server admin can get users in another org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusOK,
			expectedUserCount:   2,
			user:                testServerAdminViewer,
			targetOrg:           2,
		},
		{
			name:                "org admin cannot get users in his org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           testAdminOrg2.OrgID,
		},
		{
			name:                "org admin cannot get users in another org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           1,
		},
		{
			name:                "server admin can get users in his org",
			enableAccessControl: true,
			expectedCode:        http.StatusOK,
			expectedUserCount:   2,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgID,
		},
		{
			name:                "server admin can get users in another org",
			enableAccessControl: true,
			expectedCode:        http.StatusOK,
			expectedUserCount:   2,
			user:                testServerAdminViewer,
			targetOrg:           2,
		},
		{
			name:                "org admin can get users in their org",
			enableAccessControl: true,
			expectedCode:        http.StatusOK,
			expectedUserCount:   2,
			user:                testAdminOrg2,
			targetOrg:           testAdminOrg2.OrgID,
		},
		{
			name:                "org admin cannot get users in another org",
			enableAccessControl: true,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           1,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tc.enableAccessControl
			var err error
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				quotaService := quotatest.New(false, nil)
				hs.userService, err = userimpl.ProvideService(
					hs.SQLStore, nil, cfg, teamimpl.ProvideService(hs.SQLStore.(*sqlstore.SQLStore), cfg), localcache.ProvideService(), quotaService)
				require.NoError(t, err)
				hs.orgService, err = orgimpl.ProvideService(hs.SQLStore, cfg, quotaService)
				require.NoError(t, err)
			})
			setInitCtxSignedInUser(sc.initCtx, tc.user)
			setupOrgUsersDBForAccessControlTests(t, sc.db, sc.hs.orgService)

			// Perform test
			response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(url, tc.targetOrg), nil, t)
			require.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				var userList []*org.OrgUserDTO
				err := json.NewDecoder(response.Body).Decode(&userList)
				require.NoError(t, err)

				assert.Len(t, userList, tc.expectedUserCount)
			}
		})
	}
}

func TestPostOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	url := "/api/orgs/%v/users/"
	type testCase struct {
		name                string
		enableAccessControl bool
		user                user.SignedInUser
		targetOrg           int64
		input               string
		expectedCode        int
	}

	tests := []testCase{
		{
			name:                "server admin can add users to his org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgID,
			input:               `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(testAdminOrg2.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
		},
		{
			name:                "server admin can add users to another org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetOrg:           2,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
		},
		{
			name:                "org admin cannot add users to his org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           testAdminOrg2.OrgID,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
		},
		{
			name:                "org admin cannot add users to another org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           1,
			input:               `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(testAdminOrg2.OrgRole) + `"}`,
		},
		{
			name:                "server admin can add users to his org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgID,
			input:               `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(testAdminOrg2.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
		},
		{
			name:                "server admin can add users to another org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetOrg:           2,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
		},
		{
			name:                "org admin can add users to his org",
			enableAccessControl: true,
			user:                testAdminOrg2,
			targetOrg:           testAdminOrg2.OrgID,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
		},
		{
			name:                "org admin cannot add users to another org",
			enableAccessControl: true,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           1,
			input:               `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(testAdminOrg2.OrgRole) + `"}`,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tc.enableAccessControl
			var err error
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.orgService, err = orgimpl.ProvideService(hs.SQLStore, cfg, quotatest.New(false, nil))
				require.NoError(t, err)
				hs.userService, err = userimpl.ProvideService(
					hs.SQLStore, hs.orgService, cfg, teamimpl.ProvideService(hs.SQLStore.(*sqlstore.SQLStore), cfg), localcache.ProvideService(), quotatest.New(false, nil))
				require.NoError(t, err)
			})

			setupOrgUsersDBForAccessControlTests(t, sc.db, sc.hs.orgService)
			setInitCtxSignedInUser(sc.initCtx, tc.user)

			// Perform request
			input := strings.NewReader(tc.input)
			response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(url, tc.targetOrg), input, t)
			assert.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				// Check result
				var message util.DynMap
				err := json.NewDecoder(response.Body).Decode(&message)
				require.NoError(t, err)
			}
		})
	}
}

func TestOrgUsersAPIEndpointWithSetPerms_AccessControl(t *testing.T) {
	type accessControlTestCase2 struct {
		expectedCode int
		desc         string
		url          string
		method       string
		permissions  []accesscontrol.Permission
		input        string
	}
	tests := []accessControlTestCase2{
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can add a user as a viewer to his org",
			url:          "/api/org/users",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(org.RoleViewer) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot add a user as an editor to his org",
			url:          "/api/org/users",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(org.RoleEditor) + `"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can add a user as a viewer to his org",
			url:          "/api/orgs/1/users",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(org.RoleViewer) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot add a user as an editor to his org",
			url:          "/api/orgs/1/users",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(org.RoleEditor) + `"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can update a user's role to a viewer in his org",
			url:          fmt.Sprintf("/api/org/users/%d", testEditorOrg1.UserID),
			method:       http.MethodPatch,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "` + string(org.RoleViewer) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot update a user's role to a viewer in his org",
			url:          fmt.Sprintf("/api/org/users/%d", testEditorOrg1.UserID),
			method:       http.MethodPatch,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "` + string(org.RoleEditor) + `"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can update a user's role to a viewer in his org",
			url:          fmt.Sprintf("/api/orgs/1/users/%d", testEditorOrg1.UserID),
			method:       http.MethodPatch,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "` + string(org.RoleViewer) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot update a user's role to a viewer in his org",
			url:          fmt.Sprintf("/api/orgs/1/users/%d", testEditorOrg1.UserID),
			method:       http.MethodPatch,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersWrite, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"role": "` + string(org.RoleEditor) + `"}`,
		},
		{
			expectedCode: http.StatusOK,
			desc:         "org viewer with the correct permissions can invite a user as a viewer in his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersAdd, Scope: accesscontrol.ScopeUsersAll}},
			input:        `{"loginOrEmail": "newUserEmail@test.com", "sendEmail": false, "role": "` + string(org.RoleViewer) + `"}`,
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "org viewer with the correct permissions cannot invite a user as an editor in his org",
			url:          "/api/org/invites",
			method:       http.MethodPost,
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionUsersCreate}},
			input:        `{"loginOrEmail": "newUserEmail@test.com", "sendEmail": false, "role": "` + string(org.RoleEditor) + `"}`,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			var err error
			sc := setupHTTPServer(t, true, func(hs *HTTPServer) {
				hs.tempUserService = tempuserimpl.ProvideService(hs.SQLStore)
				hs.orgService, err = orgimpl.ProvideService(hs.SQLStore, setting.NewCfg(), quotatest.New(false, nil))
				hs.userService, err = userimpl.ProvideService(
					hs.SQLStore, nil, setting.NewCfg(), teamimpl.ProvideService(hs.SQLStore.(*sqlstore.SQLStore), setting.NewCfg()), localcache.ProvideService(), quotatest.New(false, nil))
				require.NoError(t, err)
			})
			setInitCtxSignedInViewer(sc.initCtx)
			setupOrgUsersDBForAccessControlTests(t, sc.db, sc.hs.orgService)
			setAccessControlPermissions(sc.acmock, test.permissions, sc.initCtx.OrgID)

			input := strings.NewReader(test.input)
			response := callAPI(sc.server, test.method, test.url, input, t)
			assert.Equal(t, test.expectedCode, response.Code)
		})
	}
}

func TestPatchOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	url := "/api/orgs/%v/users/%v"
	type testCase struct {
		name                string
		enableAccessControl bool
		user                user.SignedInUser
		targetUserId        int64
		targetOrg           int64
		input               string
		expectedCode        int
		expectedMessage     util.DynMap
		expectedUserRole    org.RoleType
	}

	tests := []testCase{
		{
			name:                "server admin can update users in his org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetUserId:        testEditorOrg1.UserID,
			targetOrg:           testServerAdminViewer.OrgID,
			input:               `{"role": "Viewer"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "Organization user updated"},
			expectedUserRole:    org.RoleViewer,
		},
		{
			name:                "server admin can update users in another org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           2,
			input:               `{"role": "Editor"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "Organization user updated"},
			expectedUserRole:    org.RoleEditor,
		},
		{
			name:                "org admin cannot update users in his org (legacy)",
			enableAccessControl: false,
			user:                testAdminOrg2,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           testAdminOrg2.OrgID,
			input:               `{"role": "Editor"}`,
			expectedCode:        http.StatusForbidden,
		},
		{
			name:                "org admin cannot update users in another org (legacy)",
			enableAccessControl: false,
			user:                testAdminOrg2,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           1,
			input:               `{"role": "Editor"}`,
			expectedCode:        http.StatusForbidden,
		},
		{
			name:                "server admin can update users in his org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetUserId:        testEditorOrg1.UserID,
			targetOrg:           testServerAdminViewer.OrgID,
			input:               `{"role": "Viewer"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "Organization user updated"},
			expectedUserRole:    org.RoleViewer,
		},
		{
			name:                "server admin can update users in another org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           2,
			input:               `{"role": "Editor"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "Organization user updated"},
			expectedUserRole:    org.RoleEditor,
		},
		{
			name:                "org admin can update users in his org",
			enableAccessControl: true,
			user:                testAdminOrg2,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           testAdminOrg2.OrgID,
			input:               `{"role": "Editor"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "Organization user updated"},
			expectedUserRole:    org.RoleEditor,
		},
		{
			name:                "org admin cannot update users in another org",
			enableAccessControl: true,
			user:                testAdminOrg2,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           1,
			input:               `{"role": "Editor"}`,
			expectedCode:        http.StatusForbidden,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tc.enableAccessControl
			var err error
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				quotaService := quotatest.New(false, nil)
				hs.userService, err = userimpl.ProvideService(
					hs.SQLStore, nil, cfg, teamimpl.ProvideService(hs.SQLStore.(*sqlstore.SQLStore), cfg), localcache.ProvideService(), quotaService)
				require.NoError(t, err)
				hs.orgService, err = orgimpl.ProvideService(hs.SQLStore, cfg, quotaService)
				require.NoError(t, err)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db, sc.hs.orgService)
			setInitCtxSignedInUser(sc.initCtx, tc.user)

			// Perform request
			input := strings.NewReader(tc.input)
			setInitCtxSignedInUser(sc.initCtx, tc.user)
			response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, tc.targetOrg, tc.targetUserId), input, t)
			assert.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				// Check result
				var message util.DynMap
				err := json.NewDecoder(response.Body).Decode(&message)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedMessage, message)

				getUserQuery := user.GetSignedInUserQuery{
					UserID: tc.targetUserId,
					OrgID:  tc.targetOrg,
				}
				usr, err := sc.userService.GetSignedInUser(context.Background(), &getUserQuery)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedUserRole, usr.OrgRole)
			}
		})
	}
}

func TestDeleteOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	url := "/api/orgs/%v/users/%v"
	type testCase struct {
		name                string
		enableAccessControl bool
		user                user.SignedInUser
		targetUserId        int64
		targetOrg           int64
		expectedCode        int
		expectedMessage     util.DynMap
		expectedUserCount   int
	}

	tests := []testCase{
		{
			name:                "server admin can delete users from his org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetUserId:        testEditorOrg1.UserID,
			targetOrg:           testServerAdminViewer.OrgID,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User removed from organization"},
			expectedUserCount:   1,
		},
		{
			name:                "server admin can delete users from another org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           2,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User removed from organization"},
			expectedUserCount:   1,
		},
		{
			name:                "org admin can delete users from his org (legacy)",
			enableAccessControl: false,
			user:                testAdminOrg2,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           testAdminOrg2.OrgID,
			expectedCode:        http.StatusForbidden,
		},
		{
			name:                "org admin cannot delete users from another org (legacy)",
			enableAccessControl: false,
			user:                testAdminOrg2,
			targetUserId:        testEditorOrg1.UserID,
			targetOrg:           1,
			expectedCode:        http.StatusForbidden,
		},
		{
			name:                "server admin can delete users from his org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetUserId:        testEditorOrg1.UserID,
			targetOrg:           testServerAdminViewer.OrgID,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User removed from organization"},
			expectedUserCount:   1,
		},
		{
			name:                "server admin can delete users from another org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           2,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User removed from organization"},
			expectedUserCount:   1,
		},
		{
			name:                "org admin can delete users from his org",
			enableAccessControl: true,
			user:                testAdminOrg2,
			targetUserId:        testServerAdminViewer.UserID,
			targetOrg:           testAdminOrg2.OrgID,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User removed from organization"},
			expectedUserCount:   1,
		},
		{
			name:                "org admin cannot delete users from another org",
			enableAccessControl: true,
			user:                testAdminOrg2,
			targetUserId:        testEditorOrg1.UserID,
			targetOrg:           1,
			expectedCode:        http.StatusForbidden,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tc.enableAccessControl
			var err error
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				quotaService := quotatest.New(false, nil)
				hs.userService, err = userimpl.ProvideService(
					hs.SQLStore, nil, cfg, teamimpl.ProvideService(hs.SQLStore.(*sqlstore.SQLStore), cfg), localcache.ProvideService(), quotaService)
				require.NoError(t, err)
				hs.orgService, err = orgimpl.ProvideService(hs.SQLStore, cfg, quotaService)
				require.NoError(t, err)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db, sc.hs.orgService)
			setInitCtxSignedInUser(sc.initCtx, tc.user)

			response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, tc.targetOrg, tc.targetUserId), nil, t)
			assert.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				// Check result
				var message util.DynMap
				err := json.NewDecoder(response.Body).Decode(&message)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedMessage, message)
			}
		})
	}
}
