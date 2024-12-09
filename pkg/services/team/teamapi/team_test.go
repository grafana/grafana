package teamapi

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

const (
	searchTeamsURL          = "/api/teams/search"
	createTeamURL           = "/api/teams/"
	detailTeamURL           = "/api/teams/%v"
	detailTeamPreferenceURL = "/api/teams/%v/preferences"
	teamCmd                 = `{"name": "MyTestTeam%d"}`
	teamPreferenceCmd       = `{"theme": "dark"}`
)

func TestTeamAPIEndpoint_CreateTeam(t *testing.T) {
	server := SetupAPITestServer(t, nil)

	input := strings.NewReader(fmt.Sprintf(teamCmd, 1))
	t.Run("Access control allows creating teams with the correct permissions", func(t *testing.T) {
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsCreate}}))
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	input = strings.NewReader(fmt.Sprintf(teamCmd, 2))
	t.Run("Access control prevents creating teams with the incorrect permissions", func(t *testing.T) {
		req := server.NewPostRequest(createTeamURL, input)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{}))
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestTeamAPIEndpoint_SearchTeams(t *testing.T) {
	server := SetupAPITestServer(t, nil)

	t.Run("Access control prevents searching for teams with the incorrect permissions", func(t *testing.T) {
		req := server.NewGetRequest(searchTeamsURL)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows searching for teams with the correct permissions", func(t *testing.T) {
		req := server.NewGetRequest(searchTeamsURL)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestTeamAPIEndpoint_GetTeamByID(t *testing.T) {
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}})

	url := fmt.Sprintf(detailTeamURL, 1)

	t.Run("Access control prevents getting a team when missing permissions", func(t *testing.T) {
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows getting a team with the correct permissions", func(t *testing.T) {
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevents getting a team when missing permissions by UID", func(t *testing.T) {
		url := fmt.Sprintf(detailTeamURL, "a00001")
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:2"},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows getting a team by UID with the correct permissions", func(t *testing.T) {
		url := fmt.Sprintf(detailTeamURL, "a00001")
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
		}))
		res, err := server.Send(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows getting a team with wildcard scope", func(t *testing.T) {
		req := server.NewGetRequest(url)
		req = webtest.RequestWithSignedInUser(req, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
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
func TestTeamAPIEndpoint_UpdateTeam(t *testing.T) {
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}})

	request := func(teamID any, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewRequest(http.MethodPut, fmt.Sprintf(detailTeamURL, teamID), strings.NewReader(teamCmd))
		req = webtest.RequestWithSignedInUser(req, user)
		return server.SendJSON(req)
	}

	t.Run("Access control allows updating team with the correct permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows updating team by UID with the correct permissions", func(t *testing.T) {
		res, err := request("a00001", authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows updating teams with the wildcard scope", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:*"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevent updating a team with wrong scope", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
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
func TestTeamAPIEndpoint_DeleteTeam(t *testing.T) {
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}})

	request := func(teamID any, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewRequest(http.MethodDelete, fmt.Sprintf(detailTeamURL, teamID), http.NoBody)
		req = webtest.RequestWithSignedInUser(req, user)
		return server.Send(req)
	}

	t.Run("Access control prevents deleting teams with the incorrect permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:2"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows deleting teams with the correct permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsDelete, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows deleting teams with the correct permissions by UID", func(t *testing.T) {
		res, err := request("a00001", authedUserWithPermissions(1, 1, []accesscontrol.Permission{
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
func TestTeamAPIEndpoint_GetTeamPreferences(t *testing.T) {
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}}, func(hs *TeamAPI) {
		hs.preferenceService = &preftest.FakePreferenceService{ExpectedPreference: &pref.Preference{}}
	})

	request := func(teamID any, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewGetRequest(fmt.Sprintf(detailTeamPreferenceURL, teamID))
		req = webtest.RequestWithSignedInUser(req, user)
		return server.Send(req)
	}

	t.Run("Access control allows getting team preferences with the correct permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control allows getting team preferences with the correct permissions by UID", func(t *testing.T) {
		res, err := request("a00001", authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsRead, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevents getting team preferences with the incorrect permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
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
func TestTeamAPIEndpoint_UpdateTeamPreferences(t *testing.T) {
	server := SetupAPITestServer(t, nil, func(hs *TeamAPI) {
		hs.preferenceService = &preftest.FakePreferenceService{ExpectedPreference: &pref.Preference{}}
	})

	request := func(teamID int64, user *user.SignedInUser) (*http.Response, error) {
		req := server.NewRequest(http.MethodPut, fmt.Sprintf(detailTeamPreferenceURL, teamID), strings.NewReader(teamPreferenceCmd))
		req = webtest.RequestWithSignedInUser(req, user)
		return server.SendJSON(req)
	}

	t.Run("Access control allows updating team preferences with the correct permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:1"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Access control prevents updating team preferences with the incorrect permissions", func(t *testing.T) {
		res, err := request(1, authedUserWithPermissions(1, 1, []accesscontrol.Permission{
			{Action: accesscontrol.ActionTeamsWrite, Scope: "teams:id:2"},
		}))
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}
