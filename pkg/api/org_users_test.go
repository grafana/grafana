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
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func setUpGetOrgUsersDB(t *testing.T, sqlStore *sqlstore.SQLStore) {
	sqlStore.Cfg.AutoAssignOrg = true
	sqlStore.Cfg.AutoAssignOrgId = int(testOrgID)

	_, err := sqlStore.CreateUser(context.Background(), user.CreateUserCommand{Email: "testUser@grafana.com", Login: testUserLogin})
	require.NoError(t, err)
	_, err = sqlStore.CreateUser(context.Background(), user.CreateUserCommand{Email: "user1@grafana.com", Login: "user1"})
	require.NoError(t, err)
	_, err = sqlStore.CreateUser(context.Background(), user.CreateUserCommand{Email: "user2@grafana.com", Login: "user2"})
	require.NoError(t, err)
}

func TestOrgUsersAPIEndpoint_userLoggedIn(t *testing.T) {
	hs := setupSimpleHTTPServer(featuremgmt.WithFeatures())
	settings := hs.Cfg

	sqlStore := sqlstore.InitTestDB(t)
	sqlStore.Cfg = settings
	hs.SQLStore = sqlStore
	mock := mockstore.NewSQLStoreMock()
	loggedInUserScenario(t, "When calling GET on", "api/org/users", "api/org/users", func(sc *scenarioContext) {
		setUpGetOrgUsersDB(t, sqlStore)

		sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp []models.OrgUserDTO
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Len(t, resp, 3)
	}, mock)

	loggedInUserScenario(t, "When calling GET on", "api/org/users/search", "api/org/users/search", func(sc *scenarioContext) {
		setUpGetOrgUsersDB(t, sqlStore)

		sc.handlerFunc = hs.SearchOrgUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp models.SearchOrgUsersQueryResult
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)

		assert.Len(t, resp.OrgUsers, 3)
		assert.Equal(t, int64(3), resp.TotalCount)
		assert.Equal(t, 1000, resp.PerPage)
		assert.Equal(t, 1, resp.Page)
	}, mock)

	loggedInUserScenario(t, "When calling GET with page and limit query parameters on", "api/org/users/search", "api/org/users/search", func(sc *scenarioContext) {
		setUpGetOrgUsersDB(t, sqlStore)

		sc.handlerFunc = hs.SearchOrgUsersWithPaging
		sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "2", "page": "2"}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp models.SearchOrgUsersQueryResult
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

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []models.OrgUserDTO
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

func TestOrgUsersAPIEndpoint_LegacyAccessControl_FolderAdmin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInViewer(sc.initCtx)

	// Create a dashboard folder
	cmd := models.SaveDashboardCommand{
		OrgId:    testOrgID,
		FolderId: 1,
		IsFolder: true,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": "1 test dash folder",
			"tags":  "prod",
		}),
	}
	folder, err := sc.dashboardsStore.SaveDashboard(cmd)
	require.NoError(t, err)
	require.NotNil(t, folder)

	// Grant our test Viewer with permission to admin the folder
	acls := []*models.DashboardACL{
		{
			DashboardID: folder.Id,
			OrgID:       testOrgID,
			UserID:      testUserID,
			Permission:  models.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}
	err = sc.dashboardsStore.UpdateDashboardACL(context.Background(), folder.Id, acls)
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
	team1, err := sc.db.CreateTeam("testteam1", "testteam1@example.org", testOrgID)
	require.NoError(t, err)
	err = sc.db.AddTeamMember(testUserID, testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
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
func setupOrgUsersDBForAccessControlTests(t *testing.T, db sqlstore.Store) {
	t.Helper()

	var err error

	_, err = db.CreateUser(context.Background(), user.CreateUserCommand{Email: testServerAdminViewer.Email, SkipOrgSetup: true, Login: testServerAdminViewer.Login})
	require.NoError(t, err)
	_, err = db.CreateUser(context.Background(), user.CreateUserCommand{Email: testAdminOrg2.Email, SkipOrgSetup: true, Login: testAdminOrg2.Login})
	require.NoError(t, err)
	_, err = db.CreateUser(context.Background(), user.CreateUserCommand{Email: testEditorOrg1.Email, SkipOrgSetup: true, Login: testEditorOrg1.Login})
	require.NoError(t, err)

	// Create both orgs with server admin
	_, err = db.CreateOrgWithMember(testServerAdminViewer.OrgName, testServerAdminViewer.UserID)
	require.NoError(t, err)
	_, err = db.CreateOrgWithMember(testAdminOrg2.OrgName, testServerAdminViewer.UserID)
	require.NoError(t, err)

	err = db.AddOrgUser(context.Background(), &models.AddOrgUserCommand{LoginOrEmail: testAdminOrg2.Login, Role: testAdminOrg2.OrgRole, OrgId: testAdminOrg2.OrgID, UserId: testAdminOrg2.UserID})
	require.NoError(t, err)
	err = db.AddOrgUser(context.Background(), &models.AddOrgUserCommand{LoginOrEmail: testEditorOrg1.Login, Role: testEditorOrg1.OrgRole, OrgId: testEditorOrg1.OrgID, UserId: testEditorOrg1.UserID})
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
				"org.users:write":  true,
				"org.users:add":    true,
				"org.users:read":   true,
				"org.users:remove": true},
			user:      testServerAdminViewer,
			targetOrg: testServerAdminViewer.OrgID,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBACEnabled = tc.enableAccessControl
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.userService = userimpl.ProvideService(
					hs.SQLStore, nil, nil, nil, nil,
					nil, nil, nil, nil, nil, hs.SQLStore.(*sqlstore.SQLStore),
				)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db)
			setInitCtxSignedInUser(sc.initCtx, tc.user)

			// Perform test
			response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(url, tc.targetOrg), nil, t)
			require.Equal(t, tc.expectedCode, response.Code)

			var userList []*models.OrgUserDTO
			err := json.NewDecoder(response.Body).Decode(&userList)
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
			name:                "org admin can get users in his org",
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
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.userService = userimpl.ProvideService(
					hs.SQLStore, nil, nil, nil, nil,
					nil, nil, nil, nil, nil, hs.SQLStore.(*sqlstore.SQLStore),
				)
			})
			setInitCtxSignedInUser(sc.initCtx, tc.user)
			setupOrgUsersDBForAccessControlTests(t, sc.db)

			// Perform test
			response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(url, tc.targetOrg), nil, t)
			require.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				var userList []*models.OrgUserDTO
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
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.userService = userimpl.ProvideService(
					hs.SQLStore, nil, nil, nil, nil,
					nil, nil, nil, nil, nil, hs.SQLStore.(*sqlstore.SQLStore),
				)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db)
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

				getUsersQuery := models.GetOrgUsersQuery{OrgId: tc.targetOrg, User: &user.SignedInUser{
					OrgID:       tc.targetOrg,
					Permissions: map[int64]map[string][]string{tc.targetOrg: {"org.users:read": {"users:*"}}},
				}}
				err = sc.db.GetOrgUsers(context.Background(), &getUsersQuery)
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
			sc := setupHTTPServer(t, true, func(hs *HTTPServer) {
				hs.userService = userimpl.ProvideService(
					hs.SQLStore, nil, nil, nil, nil,
					nil, nil, nil, nil, nil, hs.SQLStore.(*sqlstore.SQLStore),
				)
			})
			setInitCtxSignedInViewer(sc.initCtx)
			setupOrgUsersDBForAccessControlTests(t, sc.db)
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
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.userService = userimpl.ProvideService(
					hs.SQLStore, nil, nil, nil, nil,
					nil, nil, nil, nil, nil, hs.SQLStore.(*sqlstore.SQLStore),
				)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db)
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

				getUserQuery := models.GetSignedInUserQuery{
					UserId: tc.targetUserId,
					OrgId:  tc.targetOrg,
				}
				err = sc.db.GetSignedInUser(context.Background(), &getUserQuery)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedUserRole, getUserQuery.Result.OrgRole)
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
			sc := setupHTTPServerWithCfg(t, false, cfg, func(hs *HTTPServer) {
				hs.userService = userimpl.ProvideService(
					hs.SQLStore, nil, nil, nil, nil,
					nil, nil, nil, nil, nil, hs.SQLStore.(*sqlstore.SQLStore),
				)
			})
			setupOrgUsersDBForAccessControlTests(t, sc.db)
			setInitCtxSignedInUser(sc.initCtx, tc.user)

			response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, tc.targetOrg, tc.targetUserId), nil, t)
			assert.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				// Check result
				var message util.DynMap
				err := json.NewDecoder(response.Body).Decode(&message)
				require.NoError(t, err)
				assert.Equal(t, tc.expectedMessage, message)

				getUsersQuery := models.GetOrgUsersQuery{
					OrgId: tc.targetOrg,
					User: &user.SignedInUser{
						OrgID:       tc.targetOrg,
						Permissions: map[int64]map[string][]string{tc.targetOrg: {accesscontrol.ActionOrgUsersRead: {accesscontrol.ScopeUsersAll}}},
					},
				}
				err = sc.db.GetOrgUsers(context.Background(), &getUsersQuery)
				require.NoError(t, err)
				assert.Len(t, getUsersQuery.Result, tc.expectedUserCount)

				// check all permissions for user is removed in org
				permission, err := sc.hs.accesscontrolService.GetUserPermissions(context.Background(), &user.SignedInUser{UserID: tc.targetUserId, OrgID: tc.targetOrg}, accesscontrol.Options{})
				require.NoError(t, err)
				assert.Len(t, permission, 0)
			}
		})
	}
}
