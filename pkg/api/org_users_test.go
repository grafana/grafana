package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setUpGetOrgUsersHandler() {
	bus.AddHandler("test", func(query *models.GetOrgUsersQuery) error {
		query.Result = []*models.OrgUserDTO{
			{Email: "testUser@grafana.com", Login: testUserLogin},
			{Email: "user1@grafana.com", Login: "user1"},
			{Email: "user2@grafana.com", Login: "user2"},
		}
		return nil
	})
}

func setUpGetOrgUsersDB(t *testing.T, sqlStore *sqlstore.SQLStore) {
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgId = 1

	_, err := sqlStore.CreateUser(context.Background(), models.CreateUserCommand{Email: "testUser@grafana.com", Login: "testUserLogin"})
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
		setUpGetOrgUsersHandler()

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

	loggedInUserScenario(t, "When calling GET as an editor with no team / folder permissions on",
		"api/org/users/lookup", func(sc *scenarioContext) {
			setUpGetOrgUsersHandler()
			bus.AddHandler("test", func(query *models.HasAdminPermissionInFoldersQuery) error {
				query.Result = false
				return nil
			})
			bus.AddHandler("test", func(query *models.IsAdminOfTeamsQuery) error {
				query.Result = false
				return nil
			})

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrgLookup
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			assert.Equal(t, http.StatusForbidden, sc.resp.Code)

			var resp struct {
				Message string
			}
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)

			assert.Equal(t, "Permission denied", resp.Message)
		})

	loggedInUserScenarioWithRole(t, "When calling GET as an admin on", "GET", "api/org/users/lookup",
		"api/org/users/lookup", models.ROLE_ADMIN, func(sc *scenarioContext) {
			setUpGetOrgUsersHandler()

			sc.handlerFunc = hs.GetOrgUsersForCurrentOrgLookup
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []dtos.UserLookupDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)
			assert.Len(t, resp, 3)
		})

	t.Run("Given there is two hidden users", func(t *testing.T) {
		settings.HiddenUsers = map[string]struct{}{
			"user1":       {},
			testUserLogin: {},
		}
		t.Cleanup(func() { settings.HiddenUsers = make(map[string]struct{}) })

		loggedInUserScenario(t, "When calling GET on", "api/org/users", func(sc *scenarioContext) {
			setUpGetOrgUsersHandler()

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
				setUpGetOrgUsersHandler()

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

var (
	testServerAdminViewer = models.SignedInUser{
		UserId:         1,
		OrgId:          1,
		OrgName:        "TestOrg1",
		OrgRole:        models.ROLE_VIEWER,
		Login:          "testServerAdmin",
		Name:           "testServerAdmin",
		Email:          "testServerAdmin@example.org",
		OrgCount:       2,
		IsGrafanaAdmin: true,
		IsAnonymous:    false,
	}

	testAdminOrg2 = models.SignedInUser{
		UserId:         2,
		OrgId:          2,
		OrgName:        "TestOrg2",
		OrgRole:        models.ROLE_ADMIN,
		Login:          "testAdmin",
		Name:           "testAdmin",
		Email:          "testAdmin@example.org",
		OrgCount:       1,
		IsGrafanaAdmin: false,
		IsAnonymous:    false,
	}

	testEditorOrg1 = models.SignedInUser{
		UserId:         3,
		OrgId:          1,
		OrgName:        "TestOrg1",
		OrgRole:        models.ROLE_EDITOR,
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
func setupOrgUsersDBForAccessControlTests(t *testing.T, db sqlstore.SQLStore) {
	t.Helper()

	var err error

	_, err = db.CreateUser(context.Background(), models.CreateUserCommand{Email: testServerAdminViewer.Email, SkipOrgSetup: true, Login: testServerAdminViewer.Login})
	require.NoError(t, err)
	_, err = db.CreateUser(context.Background(), models.CreateUserCommand{Email: testAdminOrg2.Email, SkipOrgSetup: true, Login: testAdminOrg2.Login})
	require.NoError(t, err)
	_, err = db.CreateUser(context.Background(), models.CreateUserCommand{Email: testEditorOrg1.Email, SkipOrgSetup: true, Login: testEditorOrg1.Login})
	require.NoError(t, err)

	// Create both orgs with server admin
	_, err = db.CreateOrgWithMember(testServerAdminViewer.OrgName, testServerAdminViewer.UserId)
	require.NoError(t, err)
	_, err = db.CreateOrgWithMember(testAdminOrg2.OrgName, testServerAdminViewer.UserId)
	require.NoError(t, err)

	err = sqlstore.AddOrgUser(&models.AddOrgUserCommand{LoginOrEmail: testAdminOrg2.Login, Role: testAdminOrg2.OrgRole, OrgId: testAdminOrg2.OrgId, UserId: testAdminOrg2.UserId})
	require.NoError(t, err)
	err = sqlstore.AddOrgUser(&models.AddOrgUserCommand{LoginOrEmail: testEditorOrg1.Login, Role: testEditorOrg1.OrgRole, OrgId: testEditorOrg1.OrgId, UserId: testEditorOrg1.UserId})
	require.NoError(t, err)
}

// resetOrgUsersDefaultHandlers resets the handlers that the other test removes (with loggedInUserScenario)
func resetOrgUsersDefaultHandlers(t *testing.T) {
	t.Helper()

	bus.ClearBusHandlers()
	t.Cleanup(func() { bus.ClearBusHandlers() })
	bus.AddHandler("sql", sqlstore.AddOrgUser)
	bus.AddHandler("sql", sqlstore.GetUserByLogin)
	bus.AddHandler("sql", sqlstore.GetOrgUsers)
	bus.AddHandler("sql", sqlstore.UpdateOrgUser)
	bus.AddHandler("sql", sqlstore.RemoveOrgUser)
}

func TestGetOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	url := "/api/orgs/%v/users/"
	type testCase struct {
		name                string
		enableAccessControl bool
		expectedCode        int
		expectedUserCount   int
		user                models.SignedInUser
		targetOrg           int64
	}

	tests := []testCase{
		{
			name:                "server admin can get users in his org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusOK,
			expectedUserCount:   2,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgId,
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
			targetOrg:           testAdminOrg2.OrgId,
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
			targetOrg:           testServerAdminViewer.OrgId,
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
			targetOrg:           testAdminOrg2.OrgId,
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
			sc := setupHTTPServer(t, false, tc.enableAccessControl)
			resetOrgUsersDefaultHandlers(t)
			setupOrgUsersDBForAccessControlTests(t, *sc.db)
			setSignedInUser(sc.initCtx, tc.user)

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
		user                models.SignedInUser
		targetOrg           int64
		input               string
		expectedCode        int
		expectedMessage     util.DynMap
		expectedUserCount   int
	}

	tests := []testCase{
		{
			name:                "server admin can add users to his org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetOrg:           testServerAdminViewer.OrgId,
			input:               `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(testAdminOrg2.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User added to organization", "userId": float64(testAdminOrg2.UserId)},
			expectedUserCount:   3,
		},
		{
			name:                "server admin can add users to another org (legacy)",
			enableAccessControl: false,
			user:                testServerAdminViewer,
			targetOrg:           2,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User added to organization", "userId": float64(testEditorOrg1.UserId)},
			expectedUserCount:   3,
		},
		{
			name:                "org admin cannot add users to his org (legacy)",
			enableAccessControl: false,
			expectedCode:        http.StatusForbidden,
			user:                testAdminOrg2,
			targetOrg:           testAdminOrg2.OrgId,
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
			targetOrg:           testServerAdminViewer.OrgId,
			input:               `{"loginOrEmail": "` + testAdminOrg2.Login + `", "role": "` + string(testAdminOrg2.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User added to organization", "userId": float64(testAdminOrg2.UserId)},
			expectedUserCount:   3,
		},
		{
			name:                "server admin can add users to another org",
			enableAccessControl: true,
			user:                testServerAdminViewer,
			targetOrg:           2,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User added to organization", "userId": float64(testEditorOrg1.UserId)},
			expectedUserCount:   3,
		},
		{
			name:                "org admin can add users to his org",
			enableAccessControl: true,
			user:                testAdminOrg2,
			targetOrg:           testAdminOrg2.OrgId,
			input:               `{"loginOrEmail": "` + testEditorOrg1.Login + `", "role": "` + string(testEditorOrg1.OrgRole) + `"}`,
			expectedCode:        http.StatusOK,
			expectedMessage:     util.DynMap{"message": "User added to organization", "userId": float64(testEditorOrg1.UserId)},
			expectedUserCount:   3,
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
			sc := setupHTTPServer(t, false, tc.enableAccessControl)
			resetOrgUsersDefaultHandlers(t)
			setupOrgUsersDBForAccessControlTests(t, *sc.db)
			setSignedInUser(sc.initCtx, tc.user)

			// Perform request
			input := strings.NewReader(tc.input)
			response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(url, tc.targetOrg), input, t)
			assert.Equal(t, tc.expectedCode, response.Code)

			if tc.expectedCode != http.StatusForbidden {
				// Check result
				var message util.DynMap
				err := json.NewDecoder(response.Body).Decode(&message)
				require.NoError(t, err)
				assert.EqualValuesf(t, tc.expectedMessage, message, "server did not answer expected message")

				getUsersQuery := models.GetOrgUsersQuery{OrgId: tc.targetOrg}
				err = sqlstore.GetOrgUsers(&getUsersQuery)
				require.NoError(t, err)
				assert.Len(t, getUsersQuery.Result, tc.expectedUserCount)
			}
		})
	}
}

func TestPatchOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	var err error
	// Use real accesscontrol service
	sc := setupHTTPServer(t, false, true)
	resetOrgUsersDefaultHandlers(t)
	setupOrgUsersDBForAccessControlTests(t, *sc.db)

	url := "/api/orgs/%v/users/%v"
	t.Run("server admin can update users in his org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testEditorOrg1.OrgRole,
				UserId: testEditorOrg1.UserId,
				OrgId:  testServerAdminViewer.OrgId,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Viewer"}`)
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, testServerAdminViewer.OrgId, testEditorOrg1.UserId), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "Organization user updated", result["message"])

		getUserQuery := models.GetSignedInUserQuery{
			UserId: testEditorOrg1.UserId,
			OrgId:  testServerAdminViewer.OrgId,
		}
		err = sqlstore.GetSignedInUser(context.TODO(), &getUserQuery)
		require.NoError(t, err)
		assert.Equal(t, models.ROLE_VIEWER, getUserQuery.Result.OrgRole)
	})
	t.Run("server admin can update users in another org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testServerAdminViewer.OrgRole,
				UserId: testServerAdminViewer.UserId,
				OrgId:  2,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Editor"}`)
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, 2, testServerAdminViewer.UserId), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "Organization user updated", result["message"])

		getUserQuery := models.GetSignedInUserQuery{
			UserId: testServerAdminViewer.UserId,
			OrgId:  2,
		}
		err = sqlstore.GetSignedInUser(context.TODO(), &getUserQuery)
		require.NoError(t, err)
		assert.Equal(t, models.ROLE_EDITOR, getUserQuery.Result.OrgRole)
	})
	t.Run("org admin can update users in his org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testServerAdminViewer.OrgRole,
				UserId: testServerAdminViewer.UserId,
				OrgId:  testAdminOrg2.OrgId,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Editor"}`)
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, testAdminOrg2.OrgId, testServerAdminViewer.UserId), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "Organization user updated", result["message"])

		getUserQuery := models.GetSignedInUserQuery{
			UserId: testServerAdminViewer.UserId,
			OrgId:  testAdminOrg2.OrgId,
		}
		err = sqlstore.GetSignedInUser(context.TODO(), &getUserQuery)
		require.NoError(t, err)
		assert.Equal(t, models.ROLE_EDITOR, getUserQuery.Result.OrgRole)
	})
	t.Run("org admin cannot update users in another org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testServerAdminViewer.OrgRole,
				UserId: testServerAdminViewer.UserId,
				OrgId:  1,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Editor"}`)
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, 1, testServerAdminViewer.UserId), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestPatchOrgUsersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	var err error
	// Use legacy accesscontrol
	sc := setupHTTPServer(t, false, false)
	resetOrgUsersDefaultHandlers(t)
	setupOrgUsersDBForAccessControlTests(t, *sc.db)

	url := "/api/orgs/%v/users/%v"
	t.Run("server admin can update users in his org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testEditorOrg1.OrgRole,
				UserId: testEditorOrg1.UserId,
				OrgId:  testServerAdminViewer.OrgId,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Viewer"}`)
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, testServerAdminViewer.OrgId, testEditorOrg1.UserId), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "Organization user updated", result["message"])

		getUserQuery := models.GetSignedInUserQuery{
			UserId: testEditorOrg1.UserId,
			OrgId:  testServerAdminViewer.OrgId,
		}
		err = sqlstore.GetSignedInUser(context.TODO(), &getUserQuery)
		require.NoError(t, err)
		assert.Equal(t, models.ROLE_VIEWER, getUserQuery.Result.OrgRole)
	})
	t.Run("server admin can update users in another org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testServerAdminViewer.OrgRole,
				UserId: testServerAdminViewer.UserId,
				OrgId:  2,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Editor"}`)
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, 2, testServerAdminViewer.UserId), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "Organization user updated", result["message"])

		getUserQuery := models.GetSignedInUserQuery{
			UserId: testServerAdminViewer.UserId,
			OrgId:  2,
		}
		err = sqlstore.GetSignedInUser(context.TODO(), &getUserQuery)
		require.NoError(t, err)
		assert.Equal(t, models.ROLE_EDITOR, getUserQuery.Result.OrgRole)
	})
	t.Run("org admin cannot update users in his org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testServerAdminViewer.OrgRole,
				UserId: testServerAdminViewer.UserId,
				OrgId:  testAdminOrg2.OrgId,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Editor"}`)
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, testAdminOrg2.OrgId, testServerAdminViewer.UserId), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("org admin cannot update users in another org", func(t *testing.T) {
		// Reset user's role after test
		t.Cleanup(func() {
			_ = sqlstore.UpdateOrgUser(&models.UpdateOrgUserCommand{
				Role:   testServerAdminViewer.OrgRole,
				UserId: testServerAdminViewer.UserId,
				OrgId:  1,
			})
		})

		// Perform request
		input := strings.NewReader(`{"role": "Editor"}`)
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodPatch, fmt.Sprintf(url, 1, testServerAdminViewer.UserId), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestDeleteOrgUsersAPIEndpoint_AccessControl(t *testing.T) {
	var err error
	// Use real accesscontrol service
	sc := setupHTTPServer(t, false, true)
	resetOrgUsersDefaultHandlers(t)
	setupOrgUsersDBForAccessControlTests(t, *sc.db)

	url := "/api/orgs/%v/users/%v"
	t.Run("server admin can delete users from his org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testEditorOrg1.Login,
				Role:         testEditorOrg1.OrgRole,
				UserId:       testEditorOrg1.UserId,
				OrgId:        testServerAdminViewer.OrgId,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, testServerAdminViewer.OrgId, testEditorOrg1.UserId), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "User removed from organization", result["message"])

		getUsersQuery := models.GetOrgUsersQuery{OrgId: testServerAdminViewer.OrgId}
		err = sqlstore.GetOrgUsers(&getUsersQuery)
		require.NoError(t, err)
		assert.Len(t, getUsersQuery.Result, 1)
	})
	t.Run("server admin can delete users from another org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testServerAdminViewer.Login,
				Role:         testServerAdminViewer.OrgRole,
				UserId:       testServerAdminViewer.UserId,
				OrgId:        2,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, 2, testServerAdminViewer.UserId), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "User removed from organization", result["message"])

		getUsersQuery := models.GetOrgUsersQuery{OrgId: 2}
		err = sqlstore.GetOrgUsers(&getUsersQuery)
		require.NoError(t, err)
		assert.Len(t, getUsersQuery.Result, 1)
	})
	t.Run("org admin can delete users from his org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testServerAdminViewer.Login,
				Role:         testServerAdminViewer.OrgRole,
				UserId:       testServerAdminViewer.UserId,
				OrgId:        testAdminOrg2.OrgId,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, testAdminOrg2.OrgId, testServerAdminViewer.UserId), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "User removed from organization", result["message"])

		getUsersQuery := models.GetOrgUsersQuery{OrgId: testAdminOrg2.OrgId}
		err = sqlstore.GetOrgUsers(&getUsersQuery)
		require.NoError(t, err)
		assert.Len(t, getUsersQuery.Result, 1)
	})
	t.Run("org admin cannot delete users from another org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testEditorOrg1.Login,
				Role:         testEditorOrg1.OrgRole,
				UserId:       testEditorOrg1.UserId,
				OrgId:        1,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, 1, testEditorOrg1.UserId), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestDeleteOrgUsersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	var err error
	// Use legacy accesscontrol
	sc := setupHTTPServer(t, false, false)
	resetOrgUsersDefaultHandlers(t)
	setupOrgUsersDBForAccessControlTests(t, *sc.db)

	url := "/api/orgs/%v/users/%v"
	t.Run("server admin can delete users from his org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testEditorOrg1.Login,
				Role:         testEditorOrg1.OrgRole,
				UserId:       testEditorOrg1.UserId,
				OrgId:        testServerAdminViewer.OrgId,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, testServerAdminViewer.OrgId, testEditorOrg1.UserId), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "User removed from organization", result["message"])

		getUsersQuery := models.GetOrgUsersQuery{OrgId: testServerAdminViewer.OrgId}
		err = sqlstore.GetOrgUsers(&getUsersQuery)
		require.NoError(t, err)
		assert.Len(t, getUsersQuery.Result, 1)
	})
	t.Run("server admin can delete users from another org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testServerAdminViewer.Login,
				Role:         testServerAdminViewer.OrgRole,
				UserId:       testServerAdminViewer.UserId,
				OrgId:        2,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testServerAdminViewer)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, 2, testServerAdminViewer.UserId), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)

		// Check result
		var result util.DynMap
		err = json.NewDecoder(response.Body).Decode(&result)
		require.NoError(t, err)
		require.Contains(t, result, "message")
		assert.Equal(t, "User removed from organization", result["message"])

		getUsersQuery := models.GetOrgUsersQuery{OrgId: 2}
		err = sqlstore.GetOrgUsers(&getUsersQuery)
		require.NoError(t, err)
		assert.Len(t, getUsersQuery.Result, 1)
	})
	t.Run("org admin cannot delete users from his org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testServerAdminViewer.Login,
				Role:         testServerAdminViewer.OrgRole,
				UserId:       testServerAdminViewer.UserId,
				OrgId:        testAdminOrg2.OrgId,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, testAdminOrg2.OrgId, testServerAdminViewer.UserId), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
	t.Run("org admin cannot delete users from another org", func(t *testing.T) {
		// Reset user after test
		t.Cleanup(func() {
			_ = sqlstore.AddOrgUser(&models.AddOrgUserCommand{
				LoginOrEmail: testEditorOrg1.Login,
				Role:         testEditorOrg1.OrgRole,
				UserId:       testEditorOrg1.UserId,
				OrgId:        1,
			})
		})

		// Perform request
		setSignedInUser(sc.initCtx, testAdminOrg2)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(url, 1, testEditorOrg1.UserId), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}
