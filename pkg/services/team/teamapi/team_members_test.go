package teamapi

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/preference/preftest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func SetupAPITestServer(t *testing.T, teamService team.Service, opts ...func(a *TeamAPI)) *webtest.Server {
	t.Helper()
	router := routing.NewRouteRegister()
	cfg := setting.NewCfg()
	cfg.LDAPAuthEnabled = true

	if teamService == nil {
		teamService = teamtest.NewFakeService()
	}

	a := ProvideTeamAPI(router,
		teamService,
		actest.FakeService{},
		acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
		&actest.FakePermissionsService{},
		&usertest.FakeUserService{},
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
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}})

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

	t.Run("should be able to add team member with correct permission by UID", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/a00001/members", strings.NewReader("{\"userId\": 1}")),
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
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedIsMember: true, ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}})

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

	t.Run("should be able to get team members with correct permission by UID", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewGetRequest("/api/teams/a00001/members"),
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
	server := SetupAPITestServer(t, &teamtest.FakeService{ExpectedIsMember: true, ExpectedTeamDTO: &team.TeamDTO{ID: 1, UID: "a00001"}})

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

	t.Run("should be able to update team member with correct permission by team UID", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/a00001/members/1", strings.NewReader("{\"permission\": 1}")),
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
	server := SetupAPITestServer(t, nil, func(hs *TeamAPI) {
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

func Test_getTeamMembershipUpdates(t *testing.T) {
	type testCase struct {
		description     string
		input           team.SetTeamMembershipsCommand
		currentMembers  []*team.TeamMemberDTO
		expectedUpdates []accesscontrol.SetResourcePermissionCommand
		expectErr       bool
	}

	testCases := []testCase{
		{
			description: "should correctly list members and admins for a team with no current members or admins",
			input: team.SetTeamMembershipsCommand{
				Members: []string{"user1", "user2"},
				Admins:  []string{"user3"},
			},
			expectedUpdates: []accesscontrol.SetResourcePermissionCommand{
				{UserID: 1, Permission: team.PermissionTypeMember.String()},
				{UserID: 2, Permission: team.PermissionTypeMember.String()},
				{UserID: 3, Permission: team.PermissionTypeAdmin.String()},
			},
		},
		{
			description: "should correctly diff the member updates for a team with existing members and admins",
			input: team.SetTeamMembershipsCommand{
				Members: []string{"user1", "user2"},
				Admins:  []string{"user3"},
			},
			currentMembers: []*team.TeamMemberDTO{
				{Email: "user1", Permission: team.PermissionTypeMember},
				{Email: "user3", Permission: team.PermissionTypeAdmin},
			},
			expectedUpdates: []accesscontrol.SetResourcePermissionCommand{
				{UserID: 2, Permission: team.PermissionTypeMember.String()},
			},
		},
		{
			description: "should correctly update membership type for the existing members and admins",
			input: team.SetTeamMembershipsCommand{
				Members: []string{"user1", "user2"},
				Admins:  []string{"user3"},
			},
			currentMembers: []*team.TeamMemberDTO{
				{Email: "user1", Permission: team.PermissionTypeMember},
				{Email: "user2", Permission: team.PermissionTypeAdmin},
				{Email: "user3", Permission: team.PermissionTypeMember},
			},
			expectedUpdates: []accesscontrol.SetResourcePermissionCommand{
				{UserID: 2, Permission: team.PermissionTypeMember.String()},
				{UserID: 3, Permission: team.PermissionTypeAdmin.String()},
			},
		},
		{
			description: "should correctly remove current members and admins that are not in the new list",
			input: team.SetTeamMembershipsCommand{
				Members: []string{"user1"},
				Admins:  []string{"user3"},
			},
			currentMembers: []*team.TeamMemberDTO{
				{Email: "user1", UserID: 1, Permission: team.PermissionTypeMember},
				{Email: "user2", UserID: 2, Permission: team.PermissionTypeMember},
				{Email: "user3", UserID: 3, Permission: team.PermissionTypeAdmin},
				{Email: "user4", UserID: 4, Permission: team.PermissionTypeAdmin},
			},
			expectedUpdates: []accesscontrol.SetResourcePermissionCommand{
				{UserID: 2, Permission: ""},
				{UserID: 4, Permission: ""},
			},
		},
		{
			description: "should error if a non-existent user is provided",
			input: team.SetTeamMembershipsCommand{
				Members: []string{"non-existent-user", "user2"},
			},
			expectErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.description, func(t *testing.T) {
			cfg := setting.NewCfg()
			userService := &usertest.FakeUserService{
				GetByEmailFn: func(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
					id, err := strconv.Atoi(strings.TrimPrefix(query.Email, "user"))
					if err != nil {
						return nil, err
					}
					user := &user.User{
						ID:    int64(id),
						Email: query.Email,
					}
					return user, nil
				},
			}
			teamSvc := teamtest.NewFakeService()
			teamSvc.ExpectedMembers = tc.currentMembers
			tapi := ProvideTeamAPI(routing.NewRouteRegister(),
				teamSvc,
				actest.FakeService{},
				acimpl.ProvideAccessControl(featuremgmt.WithFeatures()),
				&actest.FakePermissionsService{},
				userService,
				&licensing.OSSLicensingService{},
				cfg,
				preftest.NewPreferenceServiceFake(),
				dashboards.NewFakeDashboardService(t),
			)

			user := &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin, Permissions: map[int64]map[string][]string{1: {accesscontrol.ActionOrgUsersRead: {"users:id:*"}}}}
			updates, err := tapi.getTeamMembershipUpdates(context.Background(), 1, 1, tc.input, user)
			if tc.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.ElementsMatch(t, tc.expectedUpdates, updates)
		})
	}
}

func authedUserWithPermissions(userID, orgID int64, permissions []accesscontrol.Permission) *user.SignedInUser {
	return &user.SignedInUser{UserID: userID, OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), permissions)}}
}
