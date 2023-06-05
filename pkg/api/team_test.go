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

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestTeamAPIEndpoint(t *testing.T) {
	t.Run("Given two teams", func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.Cfg.EditorsCanAdmin = true
		store := db.InitTestDB(t)
		store.Cfg = hs.Cfg
		hs.teamService = teamimpl.ProvideService(store, hs.Cfg)
		hs.SQLStore = store
		mock := dbtest.NewFakeDB()

		loggedInUserScenarioWithRole(t, "When admin is calling GET on", "GET", "/api/teams/search", "/api/teams/search",
			org.RoleAdmin, func(sc *scenarioContext) {
				_, err := hs.teamService.CreateTeam("team1", "", 1)
				require.NoError(t, err)
				_, err = hs.teamService.CreateTeam("team2", "", 1)
				require.NoError(t, err)

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				require.Equal(t, http.StatusOK, sc.resp.Code)
				var resp team.SearchTeamQueryResult
				err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.EqualValues(t, 2, resp.TotalCount)
				assert.Equal(t, 2, len(resp.Teams))
			}, mock)

		loggedInUserScenario(t, "When editor (with editors_can_admin) is calling GET on", "/api/teams/search",
			"/api/teams/search", func(sc *scenarioContext) {
				team1, err := hs.teamService.CreateTeam("team1", "", 1)
				require.NoError(t, err)
				_, err = hs.teamService.CreateTeam("team2", "", 1)
				require.NoError(t, err)

				// Adding the test user to the teams in order for him to list them
				err = hs.teamService.AddTeamMember(testUserID, testOrgID, team1.ID, false, 0)
				require.NoError(t, err)

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				require.Equal(t, http.StatusOK, sc.resp.Code)
				var resp team.SearchTeamQueryResult
				err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.EqualValues(t, 1, resp.TotalCount)
				assert.Equal(t, 1, len(resp.Teams))
			}, mock)

		loggedInUserScenario(t, "When editor (with editors_can_admin) calling GET with pagination on",
			"/api/teams/search", "/api/teams/search", func(sc *scenarioContext) {
				team1, err := hs.teamService.CreateTeam("team1", "", 1)
				require.NoError(t, err)
				team2, err := hs.teamService.CreateTeam("team2", "", 1)
				require.NoError(t, err)

				// Adding the test user to the teams in order for him to list them
				err = hs.teamService.AddTeamMember(testUserID, testOrgID, team1.ID, false, 0)
				require.NoError(t, err)
				err = hs.teamService.AddTeamMember(testUserID, testOrgID, team2.ID, false, 0)
				require.NoError(t, err)

				sc.handlerFunc = hs.SearchTeams
				sc.fakeReqWithParams("GET", sc.url, map[string]string{"perpage": "10", "page": "2"}).exec()
				require.Equal(t, http.StatusOK, sc.resp.Code)
				var resp team.SearchTeamQueryResult
				err = json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)

				assert.EqualValues(t, 2, resp.TotalCount)
				assert.Equal(t, 0, len(resp.Teams))
			}, mock)
	})

	t.Run("When creating team with API key", func(t *testing.T) {
		hs := setupSimpleHTTPServer(nil)
		hs.Cfg.EditorsCanAdmin = true
		hs.SQLStore = dbtest.NewFakeDB()
		hs.teamService = &teamtest.FakeService{}
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
			c := &contextmodel.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{},
				Logger:       logger,
			}
			c.OrgRole = org.RoleEditor
			c.Req.Body = mockRequestBody(team.CreateTeamCommand{Name: teamName})
			c.Req.Header.Add("Content-Type", "application/json")
			r := hs.CreateTeam(c)

			assert.Equal(t, 200, r.Status())
			assert.NotZero(t, logger.WarnLogs.Calls)
			assert.Equal(t, "Could not add creator to team because is not a real user", logger.WarnLogs.Message)
		})

		t.Run("with real signed in user", func(t *testing.T) {
			logger := &logtest.Fake{}
			c := &contextmodel.ReqContext{
				Context:      &web.Context{Req: req},
				SignedInUser: &user.SignedInUser{UserID: 42},
				Logger:       logger,
			}
			c.OrgRole = org.RoleEditor
			c.Req.Body = mockRequestBody(team.CreateTeamCommand{Name: teamName})
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
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.teamService = teamtest.NewFakeService()
	})

	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Organisation admin can create a team", func(t *testing.T) {
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: org.RoleAdmin})
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	input = strings.NewReader(fmt.Sprintf(teamCmd, 2))
	t.Run("Org editor and server admin cannot create a team", func(t *testing.T) {
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: org.RoleEditor, IsGrafanaAdmin: true})
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestTeamAPIEndpoint_CreateTeam_LegacyAccessControl_EditorsCanAdmin(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false
		cfg.EditorsCanAdmin = true
		hs.Cfg = cfg
		hs.teamService = teamtest.NewFakeService()
	})

	t.Run("Editors can create a team if editorsCanAdmin is set to true", func(t *testing.T) {
		input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, &user.SignedInUser{OrgRole: org.RoleAdmin})
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestTeamAPIEndpoint_CreateTeam_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = teamtest.NewFakeService()
		hs.AccessControl = acimpl.ProvideAccessControl(setting.NewCfg())
		hs.accesscontrolService = actest.FakeService{}
	})

	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Access control allows creating teams with the correct permissions", func(t *testing.T) {
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsCreate}}))
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	input = strings.NewReader(fmt.Sprintf(teamCmd, 2))
	t.Run("Access control prevents creating teams with the incorrect permissions", func(t *testing.T) {
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{}))
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestTeamAPIEndpoint_SearchTeams_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = teamtest.NewFakeService()
	})

	t.Run("Access control prevents searching for teams with the incorrect permissions", func(t *testing.T) {
		req := server.NewGetRequest(searchTeamsURL)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows searching for teams with the correct permissions", func(t *testing.T) {
		req := server.NewGetRequest(searchTeamsURL)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestTeamAPIEndpoint_GetTeamByID_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{}}
	})

	url := fmt.Sprintf(detailTeamURL, 1)

	t.Run("Access control prevents getting a team when missing permissions", func(t *testing.T) {
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows getting a team with the correct permissions", func(t *testing.T) {
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows getting a team with wildcard scope", func(t *testing.T) {
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:*"},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsWrite with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_UpdateTeam_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{}}
	})

	request := func(teamID int64, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewRequest(http.MethodPut, fmt.Sprintf(detailTeamURL, teamID), strings.NewReader(teamCmd))
		req = webtest.RequestWithSignedInUser(req, user)
		return server.SendJSON(req)
	}

	t.Run("Access control allows updating team with the correct permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows updating teams with the wildcard scope", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:*"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevent updating a team with wrong scope", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:2"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsDelete with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_DeleteTeam_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{}}
	})

	request := func(teamID int64, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewRequest(http.MethodDelete, fmt.Sprintf(detailTeamURL, teamID), http.NoBody)
		req = webtest.RequestWithSignedInUser(req, user)
		return server.Send(req)
	}

	t.Run("Access control prevents deleting teams with the incorrect permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:2"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows deleting teams with the correct permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsRead with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_GetTeamPreferences_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.preferenceService = &preftest.FakePreferenceService{ExpectedPreference: &pref.Preference{}}
	})

	request := func(teamID int64, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewGetRequest(fmt.Sprintf(detailTeamPreferenceURL, teamID))
		req = webtest.RequestWithSignedInUser(req, user)
		return server.Send(req)
	}

	t.Run("Access control allows getting team preferences with the correct permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevents getting team preferences with the incorrect permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:2"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

// Given a team with a user, when the user is granted X permission,
// Then the endpoint should return 200 if the user has accesscontrol.ActionTeamsWrite with teams:id:1 scope
// else return 403
func TestTeamAPIEndpoint_UpdateTeamPreferences_RBAC(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.preferenceService = &preftest.FakePreferenceService{ExpectedPreference: &pref.Preference{}}
	})

	request := func(teamID int64, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewRequest(http.MethodPut, fmt.Sprintf(detailTeamPreferenceURL, teamID), strings.NewReader(teamPreferenceCmd))
		req = webtest.RequestWithSignedInUser(req, user)
		return server.SendJSON(req)
	}

	t.Run("Access control allows updating team preferences with the correct permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevents updating team preferences with the incorrect permissions", func(t *testing.T) {
		res, err := request(1, userWithPermissions(1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:2"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}
