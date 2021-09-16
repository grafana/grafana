package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setUpGetOrgUsersDB(t *testing.T, sqlStore *sqlstore.SQLStore) {
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgId = int(testOrgID)

	_, err := sqlStore.CreateUser(context.Background(), models.CreateUserCommand{Email: "testUser@grafana.com", Login: testUserLogin})
	require.NoError(t, err)
	_, err = sqlStore.CreateUser(context.Background(), models.CreateUserCommand{Email: "user1@grafana.com", Login: "user1"})
	require.NoError(t, err)
	_, err = sqlStore.CreateUser(context.Background(), models.CreateUserCommand{Email: "user2@grafana.com", Login: "user2"})
	require.NoError(t, err)
}

func TestOrgUsersAPIEndpoint_userLoggedIn(t *testing.T) {
	settings := setting.NewCfg()
	hs := &HTTPServer{Cfg: settings}

	sqlStore := sqlstore.InitTestDB(t)

	loggedInUserScenario(t, "When calling GET on", "api/org/users", func(sc *scenarioContext) {
		setUpGetOrgUsersDB(t, sqlStore)

		sc.handlerFunc = hs.GetOrgUsersForCurrentOrg
		sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

		require.Equal(t, http.StatusOK, sc.resp.Code)

		var resp []models.OrgUserDTO
		err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Len(t, resp, 3)
	})

	loggedInUserScenario(t, "When calling GET on", "api/org/users/search", func(sc *scenarioContext) {
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
	})

	loggedInUserScenario(t, "When calling GET with page and limit query parameters on", "api/org/users/search", func(sc *scenarioContext) {
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
	})

	t.Run("Given there are two hidden users", func(t *testing.T) {
		settings.HiddenUsers = map[string]struct{}{
			"user1":       {},
			testUserLogin: {},
		}
		t.Cleanup(func() { settings.HiddenUsers = make(map[string]struct{}) })

		loggedInUserScenario(t, "When calling GET on", "api/org/users", func(sc *scenarioContext) {
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
		})

		loggedInUserScenarioWithRole(t, "When calling GET as an admin on", "GET", "api/org/users/lookup",
			"api/org/users/lookup", models.ROLE_ADMIN, func(sc *scenarioContext) {
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
			})
	})
}

func setupOrgUsersAPIcontext(t *testing.T, role models.RoleType) (*scenarioContext, *sqlstore.SQLStore) {
	cfg := setting.NewCfg()
	db := sqlstore.InitTestDB(t)

	hs := &HTTPServer{
		Cfg:           cfg,
		QuotaService:  &quota.QuotaService{Cfg: cfg},
		RouteRegister: routing.NewRouteRegister(),
		AccessControl: accesscontrolmock.New().WithDisabled(),
		SQLStore:      db,
	}

	sc := setupScenarioContext(t, "/api/org/users/lookup")
	// Create a middleware to pretend user is logged in
	pretendSignInMiddleware := func(c *models.ReqContext) {
		sc.context = c
		sc.context.UserId = testUserID
		sc.context.OrgId = testOrgID
		sc.context.Login = testUserLogin
		sc.context.OrgRole = role
		sc.context.IsSignedIn = true
	}
	sc.m.Use(pretendSignInMiddleware)

	hs.registerRoutes()
	hs.RouteRegister.Register(sc.m.Router)

	return sc, db
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_FolderAdmin(t *testing.T) {
	sc, db := setupOrgUsersAPIcontext(t, models.ROLE_VIEWER)

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
	folder, err := db.SaveDashboard(cmd)
	require.NoError(t, err)
	require.NotNil(t, folder)

	// Grant our test Viewer with permission to admin the folder
	acls := []*models.DashboardAcl{
		{
			DashboardID: folder.Id,
			OrgID:       testOrgID,
			UserID:      testUserID,
			Permission:  models.PERMISSION_ADMIN,
			Created:     time.Now(),
			Updated:     time.Now(),
		},
	}
	err = db.UpdateDashboardACL(folder.Id, acls)
	require.NoError(t, err)

	sc.resp = httptest.NewRecorder()

	sc.req, err = http.NewRequest(http.MethodGet, "/api/org/users/lookup", nil)
	require.NoError(t, err)

	sc.exec()
	assert.Equal(t, http.StatusOK, sc.resp.Code)
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_TeamAdmin(t *testing.T) {
	sc, db := setupOrgUsersAPIcontext(t, models.ROLE_VIEWER)

	// Setup store teams
	team1, err := db.CreateTeam("testteam1", "testteam1@example.org", testOrgID)
	require.NoError(t, err)
	err = db.AddTeamMember(testUserID, testOrgID, team1.Id, false, models.PERMISSION_ADMIN)
	require.NoError(t, err)

	sc.resp = httptest.NewRecorder()

	sc.req, err = http.NewRequest(http.MethodGet, "/api/org/users/lookup", nil)
	require.NoError(t, err)

	sc.exec()
	assert.Equal(t, http.StatusOK, sc.resp.Code)
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_Admin(t *testing.T) {
	sc, _ := setupOrgUsersAPIcontext(t, models.ROLE_ADMIN)
	sc.resp = httptest.NewRecorder()

	var err error
	sc.req, err = http.NewRequest(http.MethodGet, "/api/org/users/lookup", nil)
	require.NoError(t, err)

	sc.exec()
	assert.Equal(t, http.StatusOK, sc.resp.Code)
}

func TestOrgUsersAPIEndpoint_LegacyAccessControl_Viewer(t *testing.T) {
	sc, _ := setupOrgUsersAPIcontext(t, models.ROLE_VIEWER)
	sc.resp = httptest.NewRecorder()

	var err error
	sc.req, err = http.NewRequest(http.MethodGet, "/api/org/users/lookup", nil)
	require.NoError(t, err)

	sc.exec()
	assert.Equal(t, http.StatusForbidden, sc.resp.Code)
}

func TestOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	tests := []accessControlTestCase{
		{
			expectedCode: http.StatusOK,
			desc:         "UsersLookupGet should return 200 for user with correct permissions",
			url:          "/api/org/users/lookup",
			method:       http.MethodGet,
			permissions:  []*accesscontrol.Permission{{Action: accesscontrol.ActionOrgUsersRead, Scope: accesscontrol.ScopeUsersAll}},
		},
		{

			expectedCode: http.StatusForbidden,
			desc:         "UsersLookupGet should return 403 for user without required permissions",
			url:          "/api/org/users/lookup",
			method:       http.MethodGet,
			permissions:  []*accesscontrol.Permission{{Action: "wrong"}},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			sc, hs := setupAccessControlScenarioContext(t, cfg, test.url, test.permissions)

			// Create a middleware to pretend user is logged in
			pretendSignInMiddleware := func(c *models.ReqContext) {
				sc.context = c
				sc.context.UserId = testUserID
				sc.context.OrgId = testOrgID
				sc.context.Login = testUserLogin
				sc.context.OrgRole = models.ROLE_VIEWER
				sc.context.IsSignedIn = true
			}
			sc.m.Use(pretendSignInMiddleware)

			sc.resp = httptest.NewRecorder()
			hs.SettingsProvider = &setting.OSSImpl{Cfg: cfg}

			var err error
			sc.req, err = http.NewRequest(test.method, test.url, nil)
			require.NoError(t, err)

			sc.exec()
			assert.Equal(t, test.expectedCode, sc.resp.Code)
		})
	}
}
