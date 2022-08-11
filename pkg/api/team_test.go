package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestTeamAPIEndpoint(t *testing.T) {
	t.Run("Given two teams", func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.Cfg.EditorsCanAdmin = true
		store := sqlstore.InitTestDB(t)
		store.Cfg = hs.Cfg
		hs.SQLStore = store
		mock := &mockstore.SQLStoreMock{}

		loggedInUserScenarioWithRole(t, "When admin is calling GET on", "GET", "/api/teams/search", "/api/teams/search",
			org.RoleAdmin, func(sc *scenarioContext) {
				_, err := hs.SQLStore.CreateTeam("team1", "", 1)
				require.NoError(t, err)
				_, err = hs.SQLStore.CreateTeam("team2", "", 1)
				require.NoError(t, err)

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				require.Equal(t, http.StatusOK, sc.resp.Code)
				var resp models.SearchTeamQueryResult
				err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.EqualValues(t, 2, resp.TotalCount)
				assert.Equal(t, 2, len(resp.Teams))
			}, mock)

		loggedInUserScenario(t, "When editor (with editors_can_admin) is calling GET on", "/api/teams/search",
			"/api/teams/search", func(sc *scenarioContext) {
				team1, err := hs.SQLStore.CreateTeam("team1", "", 1)
				require.NoError(t, err)
				_, err = hs.SQLStore.CreateTeam("team2", "", 1)
				require.NoError(t, err)

				// Adding the test user to the teams in order for him to list them
				err = hs.SQLStore.AddTeamMember(testUserID, testOrgID, team1.Id, false, 0)
				require.NoError(t, err)

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				require.Equal(t, http.StatusOK, sc.resp.Code)
				var resp models.SearchTeamQueryResult
				err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.EqualValues(t, 1, resp.TotalCount)
				assert.Equal(t, 1, len(resp.Teams))
			}, mock)

		loggedInUserScenario(t, "When editor (with editors_can_admin) calling GET with pagination on",
			"/api/teams/search", "/api/teams/search", func(sc *scenarioContext) {
				team1, err := hs.SQLStore.CreateTeam("team1", "", 1)
				require.NoError(t, err)
				team2, err := hs.SQLStore.CreateTeam("team2", "", 1)
				require.NoError(t, err)

				// Adding the test user to the teams in order for him to list them
				err = hs.SQLStore.AddTeamMember(testUserID, testOrgID, team1.Id, false, 0)
				require.NoError(t, err)
				err = hs.SQLStore.AddTeamMember(testUserID, testOrgID, team2.Id, false, 0)
				require.NoError(t, err)

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()
				require.Equal(t, http.StatusOK, sc.resp.Code)
				var resp models.SearchTeamQueryResult
				err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.EqualValues(t, 2, resp.TotalCount)
				assert.Equal(t, 0, len(resp.Teams))
			}, mock)
	})

	t.Run("When creating team with API key", func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.Cfg.EditorsCanAdmin = true
		hs.SQLStore = mockstore.NewSQLStoreMock()
		teamName := "team foo"

		addTeamMemberCalled := 0
		addOrUpdateTeamMember = func(ctx context.Context, resourcePermissionService accesscontrol.TeamPermissionsService, userID, orgID, teamID int64,
			permission string) error {
			addTeamMemberCalled++
			return nil
		}

		req, err := http.NewRequest("POST", "/api/teams", nil)
		require.NoError(t, err)

		t.Run("with no real signed in user", func(t *testing.T) {
			logger := &logtest.Fake{}
			c := &models.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{},
				Logger:       logger,
			}
			c.OrgRole = org.RoleEditor
			c.Req.Body = mockRequestBody(models.CreateTeamCommand{Name: teamName})
			c.Req.Header.Add("Content-Type", "application/json")
			r := hs.CreateTeam(c)

			assert.Equal(t, 200, r.Status())
			assert.NotZero(t, logger.WarnLogs.Calls)
			assert.Equal(t, "Could not add creator to team because is not a real user", logger.WarnLogs.Message)
		})

		t.Run("with real signed in user", func(t *testing.T) {
			logger := &logtest.Fake{}
			c := &models.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{UserID: 42},
				Logger:       logger,
			}
			c.OrgRole = org.RoleEditor
			c.Req.Body = mockRequestBody(models.CreateTeamCommand{Name: teamName})
			c.Req.Header.Add("Content-Type", "application/json")
			r := hs.CreateTeam(c)
			assert.Equal(t, 200, r.Status())
			assert.Zero(t, logger.WarnLogs.Calls)
		})
	})
}

const (
	searchTeamsURL          = "/api/teams/search"
	createTeamURL           = "/api/teams/"
	detailTeamURL           = "/api/teams/%d"
	detailTeamPreferenceURL = "/api/teams/%d/preferences"
	teamCmd                 = `{"name": "MyTestTeam%d"}`
	teamPreferenceCmd       = `{"theme": "dark"}`
	teamPreferenceCmdLight  = `{"theme": "light"}`
)

func TestTeamAPIEndpoint_CreateTeam_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	sc := setupHTTPServerWithCfg(t, true, cfg)
	setInitCtxSignedInOrgAdmin(sc.initCtx)

	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Organisation admin can create a team", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createTeamURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInEditor(sc.initCtx)
	sc.initCtx.IsGrafanaAdmin = true
	input = strings.NewReader(fmt.Sprintf(teamCmd, 2))
	t.Run("Org editor and server admin cannot create a team", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createTeamURL, strings.NewReader(teamCmd), t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestTeamAPIEndpoint_CreateTeam_LegacyAccessControl_EditorsCanAdmin(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RBACEnabled = false
	cfg.EditorsCanAdmin = true
	sc := setupHTTPServerWithCfg(t, true, cfg)

	setInitCtxSignedInEditor(sc.initCtx)
	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Editors can create a team if editorsCanAdmin is set to true", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, createTeamURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestTeamAPIEndpoint_CreateTeam_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)

	setInitCtxSignedInViewer(sc.initCtx)
	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Access control allows creating teams with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsCreate}}, 1)
		response := callAPI(sc.server, http.MethodPost, createTeamURL, input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	input = strings.NewReader(fmt.Sprintf(teamCmd, 2))
	t.Run("Access control prevents creating teams with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: "teams:invalid"}}, accesscontrol.GlobalOrgID)
		response := callAPI(sc.server, http.MethodPost, createTeamURL, input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestTeamAPIEndpoint_SearchTeams_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)
	// Seed three teams
	for i := 1; i <= 3; i++ {
		_, err := sc.db.CreateTeam(fmt.Sprintf("team%d", i), fmt.Sprintf("team%d@example.org", i), 1)
		require.NoError(t, err)
	}

	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("Access control prevents searching for teams with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:*"}}, 1)
		response := callAPI(sc.server, http.MethodGet, searchTeamsURL, http.NoBody, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("Access control allows searching for teams with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:*"}}, 1)
		response := callAPI(sc.server, http.MethodGet, searchTeamsURL, http.NoBody, t)
		assert.Equal(t, http.StatusOK, response.Code)

		res := &models.SearchTeamQueryResult{}
		err := json.Unmarshal(response.Body.Bytes(), res)
		require.NoError(t, err)
		require.Len(t, res.Teams, 3, "expected all teams to have been returned")
		require.Equal(t, res.TotalCount, int64(3), "expected count to match teams length")
	})

	t.Run("Access control filters teams based on user permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}, {Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:3"}}, 1)
		response := callAPI(sc.server, http.MethodGet, searchTeamsURL, http.NoBody, t)
		assert.Equal(t, http.StatusOK, response.Code)

		res := &models.SearchTeamQueryResult{}
		err := json.Unmarshal(response.Body.Bytes(), res)
		require.NoError(t, err)
		require.Len(t, res.Teams, 2, "expected a subset of teams to have been returned")
		require.Equal(t, res.TotalCount, int64(2), "expected count to match teams length")
		for _, team := range res.Teams {
			require.NotEqual(t, team.Name, "team2", "expected team2 to have been filtered")
		}
	})
}

func TestTeamAPIEndpoint_GetTeamByID_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)
	sc.db = sqlstore.InitTestDB(t)

	_, err := sc.db.CreateTeam("team1", "team1@example.org", 1)
	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("Access control prevents getting a team with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(detailTeamURL, 1), http.NoBody, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("Access control allows getting a team with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(detailTeamURL, 1), http.NoBody, t)
		assert.Equal(t, http.StatusOK, response.Code)

		res := &models.TeamDTO{}
		err := json.Unmarshal(response.Body.Bytes(), res)
		require.NoError(t, err)
		assert.Equal(t, "team1", res.Name)
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsWrite with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_UpdateTeam_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)
	sc.db = sqlstore.InitTestDB(t)
	_, err := sc.db.CreateTeam("team1", "", 1)

	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)

	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Access control allows updating teams with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(detailTeamURL, 1), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		teamQuery := &models.GetTeamByIdQuery{OrgId: 1, SignedInUser: sc.initCtx.SignedInUser, Id: 1, Result: &models.TeamDTO{}}
		err := sc.db.GetTeamById(context.Background(), teamQuery)
		require.NoError(t, err)
		assert.Equal(t, "MyTestTeam1", teamQuery.Result.Name)
	})

	input = strings.NewReader(fmt.Sprintf(teamCmd, 2))
	t.Run("Access control allows updating teams with the correct global permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:*"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(detailTeamURL, 1), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		teamQuery := &models.GetTeamByIdQuery{OrgId: 1, SignedInUser: sc.initCtx.SignedInUser, Id: 1, Result: &models.TeamDTO{}}
		err := sc.db.GetTeamById(context.Background(), teamQuery)
		require.NoError(t, err)
		assert.Equal(t, "MyTestTeam2", teamQuery.Result.Name)
	})

	input = strings.NewReader(fmt.Sprintf(teamCmd, 3))
	t.Run("Access control prevents updating teams with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(detailTeamURL, 1), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)

		teamQuery := &models.GetTeamByIdQuery{OrgId: 1, SignedInUser: sc.initCtx.SignedInUser, Id: 1, Result: &models.TeamDTO{}}
		err := sc.db.GetTeamById(context.Background(), teamQuery)
		assert.NoError(t, err)
		assert.Equal(t, "MyTestTeam2", teamQuery.Result.Name)
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsDelete with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_DeleteTeam_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)
	sc.db = sqlstore.InitTestDB(t)
	_, err := sc.db.CreateTeam("team1", "", 1)
	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("Access control prevents deleting teams with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:7"}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(detailTeamURL, 1), http.NoBody, t)
		assert.Equal(t, http.StatusForbidden, response.Code)

		teamQuery := &models.GetTeamByIdQuery{OrgId: 1, SignedInUser: sc.initCtx.SignedInUser, Id: 1, Result: &models.TeamDTO{}}
		err := sc.db.GetTeamById(context.Background(), teamQuery)
		require.NoError(t, err)
	})

	t.Run("Access control allows deleting teams with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(detailTeamURL, 1), http.NoBody, t)
		assert.Equal(t, http.StatusOK, response.Code)

		teamQuery := &models.GetTeamByIdQuery{OrgId: 1, SignedInUser: sc.initCtx.SignedInUser, Id: 1, Result: &models.TeamDTO{}}
		err := sc.db.GetTeamById(context.Background(), teamQuery)
		require.ErrorIs(t, err, models.ErrTeamNotFound)
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsRead with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_GetTeamPreferences_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)
	sc.db = sqlstore.InitTestDB(t)
	_, err := sc.db.CreateTeam("team1", "", 1)

	sqlstore := mockstore.NewSQLStoreMock()
	sc.hs.SQLStore = sqlstore

	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{}
	sc.hs.preferenceService = prefService

	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)

	t.Run("Access control allows getting team preferences with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock,
			[]accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(detailTeamPreferenceURL, 1), http.NoBody, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("Access control prevents getting team preferences with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(detailTeamPreferenceURL, 1), http.NoBody, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsWrite with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_UpdateTeamPreferences_RBAC(t *testing.T) {
	sc := setupHTTPServer(t, true)
	sqlStore := sqlstore.InitTestDB(t)
	sc.db = sqlStore

	prefService := preftest.NewPreferenceServiceFake()
	prefService.ExpectedPreference = &pref.Preference{Theme: "dark"}
	sc.hs.preferenceService = prefService

	_, err := sc.db.CreateTeam("team1", "", 1)

	require.NoError(t, err)

	setInitCtxSignedInViewer(sc.initCtx)

	input := strings.NewReader(teamPreferenceCmd)
	t.Run("Access control allows updating team preferences with the correct permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(detailTeamPreferenceURL, 1), input, t)
		assert.Equal(t, http.StatusOK, response.Code)

		prefQuery := &pref.GetPreferenceQuery{OrgID: 1, TeamID: 1}
		preference, err := prefService.Get(context.Background(), prefQuery)
		require.NoError(t, err)
		assert.Equal(t, "dark", preference.Theme)
	})

	input = strings.NewReader(teamPreferenceCmdLight)
	t.Run("Access control prevents updating team preferences with the incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(detailTeamPreferenceURL, 1), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)

		prefQuery := &pref.GetPreferenceQuery{OrgID: 1, TeamID: 1}
		preference, err := prefService.Get(context.Background(), prefQuery)
		assert.NoError(t, err)
		assert.Equal(t, "dark", preference.Theme)
	})
}
