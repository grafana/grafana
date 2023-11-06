package teamapi

import (
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func SetupAPITestServer(t *testing.T, opts ...func(a *TeamAPI)) *webtest.Server {
	t.Helper()
	router := routing.NewRouteRegister()
	cfg := setting.NewCfg()
	cfg.LDAPAuthEnabled = true

	a := ProvideTeamAPI(router,
		teamtest.NewFakeService(),
		actest.FakeService{},
		acimpl.ProvideAccessControl(cfg),
		&actest.FakePermissionsService{},
		&licensing.OSSLicensingService{},
		cfg,
		preftest.NewPreferenceServiceFake(),
		dashboards.NewFakeDashboardService(t),
	)
	for _, o := range opts {
		o(a)
	}

	server := webtest.NewServer(t, router)

	return server
}

func TestAddTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t)

	t.Run("should be able to add team member with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should not be able to add team member without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestGetTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t)

	t.Run("should be able to get team members with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/teams/1/members"),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("should not be able to get team members without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/teams/1/members"),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsRead, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestUpdateTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *TeamAPI) {
		hs.teamService = &teamtest.FakeService{ExpectedIsMember: true}
	})

	t.Run("should be able to update team member with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 1}")),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("should not be able to update team member without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 1}")),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestDeleteTeamMembersAPIEndpoint(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *TeamAPI) {
		hs.teamService = &teamtest.FakeService{ExpectedIsMember: true}
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("should be able to delete team member with correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
	t.Run("should not be able to delete member without correct permission", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			authedUserWithPermissions(1, 1, []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}),
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func authedUserWithPermissions(userID, orgID int64, permissions []accesscontrol.Permission) *user.SignedInUser {
	return &user.SignedInUser{UserID: userID, OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByAction(permissions)}}
}
