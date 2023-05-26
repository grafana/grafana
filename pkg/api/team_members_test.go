package api

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAddTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = teamtest.NewFakeService()
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("should be able to add team member with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should not be able to add team member without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestGetTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = teamtest.NewFakeService()
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("should be able to get team members with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/teams/1/members"),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsRead, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("should not be able to get team members without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/teams/1/members"),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsRead, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestUpdateTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = &teamtest.FakeService{ExpectedIsMember: true}
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("should be able to update team member with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 1}")),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("should not be able to update team member without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 1}")),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestDeleteTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		hs.Cfg = setting.NewCfg()
		hs.teamService = &teamtest.FakeService{ExpectedIsMember: true}
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("should be able to delete team member with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("should not be able to delete member without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			userWithPermissions(1, []ac.Permission{{Action: ac.ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}
