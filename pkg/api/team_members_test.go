package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/teamguardian/database"
	"github.com/grafana/grafana/pkg/services/teamguardian/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type TeamGuardianMock struct {
	result error
}

func (t *TeamGuardianMock) CanAdmin(ctx context.Context, orgId int64, teamId int64, user *user.SignedInUser) error {
	return t.result
}

func (t *TeamGuardianMock) DeleteByUser(ctx context.Context, userID int64) error {
	return t.result
}

func setUpGetTeamMembersHandler(t *testing.T, sqlStore *sqlstore.SQLStore) {
	const testOrgID int64 = 1
	var userCmd user.CreateUserCommand
	teamSvc := teamimpl.ProvideService(sqlStore, setting.NewCfg())
	team, err := teamSvc.CreateTeam("group1 name", "test1@test.com", testOrgID)
	require.NoError(t, err)
	quotaService := quotaimpl.ProvideService(sqlStore, sqlStore.Cfg)
	orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
	require.NoError(t, err)
	usrSvc, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		userCmd = user.CreateUserCommand{
			Email: fmt.Sprint("user", i, "@test.com"),
			Name:  fmt.Sprint("user", i),
			Login: fmt.Sprint("loginuser", i),
		}
		// user
		user, err := usrSvc.Create(context.Background(), &userCmd)
		require.NoError(t, err)
		err = teamSvc.AddTeamMember(user.ID, testOrgID, team.ID, false, 1)
		require.NoError(t, err)
	}
}

func TestTeamMembersAPIEndpoint_userLoggedIn(t *testing.T) {
	hs := setupSimpleHTTPServer(nil)
	settings := hs.Cfg
	sqlStore := db.InitTestDB(t)
	sqlStore.Cfg = settings

	hs.SQLStore = sqlStore
	hs.teamService = teamimpl.ProvideService(sqlStore, settings)
	hs.License = &licensing.OSSLicensingService{}
	hs.teamGuardian = &TeamGuardianMock{}
	mock := dbtest.NewFakeDB()

	loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "api/teams/1/members",
		"api/teams/:teamId/members", org.RoleAdmin, func(sc *scenarioContext) {
			setUpGetTeamMembersHandler(t, sqlStore)

			sc.handlerFunc = hs.GetTeamMembers
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			require.Equal(t, http.StatusOK, sc.resp.Code)

			var resp []team.TeamMemberDTO
			err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
			require.NoError(t, err)
			assert.Len(t, resp, 3)
		}, mock)

	t.Run("Given there is two hidden users", func(t *testing.T) {
		settings.HiddenUsers = map[string]struct{}{
			"user1":       {},
			testUserLogin: {},
		}
		t.Cleanup(func() { settings.HiddenUsers = make(map[string]struct{}) })

		loggedInUserScenarioWithRole(t, "When calling GET on", "GET", "api/teams/1/members",
			"api/teams/:teamId/members", org.RoleAdmin, func(sc *scenarioContext) {
				setUpGetTeamMembersHandler(t, sqlStore)

				sc.handlerFunc = hs.GetTeamMembers
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, http.StatusOK, sc.resp.Code)

				var resp []team.TeamMemberDTO
				err := json.Unmarshal(sc.resp.Body.Bytes(), &resp)
				require.NoError(t, err)
				assert.Len(t, resp, 3)
				assert.Equal(t, "loginuser0", resp[0].Login)
				assert.Equal(t, "loginuser1", resp[1].Login)
				assert.Equal(t, "loginuser2", resp[2].Login)
			}, mock)
	})
}

func TestAddTeamMembersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false
		cfg.EditorsCanAdmin = true
		hs.Cfg = cfg
		hs.teamService = teamtest.NewFakeService()
		store := &database.TeamGuardianStoreMock{}
		store.On("GetTeamMembers", mock.Anything, mock.Anything).Return([]*team.TeamMemberDTO{
			{UserID: 2, Permission: dashboards.PERMISSION_ADMIN},
			{UserID: 3, Permission: dashboards.PERMISSION_VIEW},
		}, nil).Maybe()
		hs.teamGuardian = manager.ProvideService(store)
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("Admin can add team member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			&user.SignedInUser{OrgID: 1, OrgRole: org.RoleAdmin},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Editor cannot add team member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			&user.SignedInUser{OrgID: 1, OrgRole: org.RoleEditor},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("team member cannot add members", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			&user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleViewer},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("team admin can add members", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPost, "/api/teams/1/members", strings.NewReader("{\"userId\": 1}")),
			&user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleEditor},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestAddTeamMembersAPIEndpoint_RBAC(t *testing.T) {
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

func TestGetTeamMembersAPIEndpoint_RBAC(t *testing.T) {
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

func TestUpdateTeamMembersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false
		cfg.EditorsCanAdmin = true
		hs.Cfg = cfg
		hs.teamService = &teamtest.FakeService{ExpectedIsMember: true}
		store := &database.TeamGuardianStoreMock{}
		store.On("GetTeamMembers", mock.Anything, mock.Anything).Return([]*team.TeamMemberDTO{
			{UserID: 2, Permission: dashboards.PERMISSION_ADMIN},
			{UserID: 3, Permission: dashboards.PERMISSION_VIEW},
		}, nil).Maybe()
		hs.teamGuardian = manager.ProvideService(store)
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("Admin can update team member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 4}")),
			&user.SignedInUser{OrgID: 1, OrgRole: org.RoleAdmin},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Editor cannot update team member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 4}")),
			&user.SignedInUser{OrgID: 1, OrgRole: org.RoleEditor},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("team member cannot update member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 4}")),
			&user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleViewer},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("team admin can add members", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodPut, "/api/teams/1/members/1", strings.NewReader("{\"permission\": 4}")),
			&user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleEditor},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestUpdateTeamMembersAPIEndpoint_RBAC(t *testing.T) {
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

func TestDeleteTeamMembersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	server := SetupAPITestServer(t, func(hs *HTTPServer) {
		cfg := setting.NewCfg()
		cfg.RBACEnabled = false
		cfg.EditorsCanAdmin = true
		hs.Cfg = cfg
		hs.teamService = &teamtest.FakeService{ExpectedIsMember: true}
		store := &database.TeamGuardianStoreMock{}
		store.On("GetTeamMembers", mock.Anything, mock.Anything).Return([]*team.TeamMemberDTO{
			{UserID: 2, Permission: dashboards.PERMISSION_ADMIN},
			{UserID: 3, Permission: dashboards.PERMISSION_VIEW},
		}, nil).Maybe()
		hs.teamGuardian = manager.ProvideService(store)
		hs.teamPermissionsService = &actest.FakePermissionsService{}
	})

	t.Run("Admin can delete team member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			&user.SignedInUser{OrgID: 1, OrgRole: org.RoleAdmin},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("Editor cannot delete team member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			&user.SignedInUser{OrgID: 1, OrgRole: org.RoleEditor},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("team member cannot delete member", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			&user.SignedInUser{UserID: 3, OrgID: 1, OrgRole: org.RoleViewer},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusForbidden, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})

	t.Run("team admin can delete members", func(t *testing.T) {
		req := webtest.RequestWithSignedInUser(
			server.NewRequest(http.MethodDelete, "/api/teams/1/members/1", nil),
			&user.SignedInUser{UserID: 2, OrgID: 1, OrgRole: org.RoleEditor},
		)
		res, err := server.SendJSON(req)
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, res.StatusCode)
		require.NoError(t, res.Body.Close())
	})
}

func TestDeleteTeamMembersAPIEndpoint_RBAC(t *testing.T) {
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
