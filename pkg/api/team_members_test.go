package api

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/teamguardian/database"
	"github.com/grafana/grafana/pkg/services/teamguardian/manager"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createUser(db *sqlstore.SQLStore, t *testing.T) *models.User {
	user, err := db.CreateUser(context.Background(), models.CreateUserCommand{
		Login:    fmt.Sprintf("TestUser%d", rand.Int()),
		OrgId:    1,
		Password: "password",
	})
	require.NoError(t, err)

	return user
}

func setupTeamTestScenario(userCount int, db *sqlstore.SQLStore, t *testing.T) ([]*models.User, models.Team) {
	team, err := db.CreateTeam("test", "test@test.com", 1)
	require.NoError(t, err)

	var users []*models.User
	for i := 0; i < userCount; i++ {
		user := createUser(db, t)
		require.NoError(t, err)
		users = append(users, user)

		err = db.AddTeamMember(user.Id, 1, team.Id, false, 0)
		require.NoError(t, err)
	}

	return users, team
}

var (
	teamMemberGetRoute    = "/api/teams/%s/members"
	teamMemberAddRoute    = "/api/teams/%s/members"
	createTeamMemberCmd   = `{"userId": %d}`
	teamMemberUpdateRoute = "/api/teams/%s/members/%s"
	updateTeamMemberCmd   = `{"permission": %d}`
	teamMemberDeleteRoute = "/api/teams/%s/members/%s"
)

func TestTeamMembersAPIEndpoint_userLoggedIn(t *testing.T) {
	sc := setupHTTPServer(t, true, false)
	sc.hs.License = &licensing.OSSLicensingService{}

	teamMemberCount := 3
	users, _ := setupTeamTestScenario(teamMemberCount, sc.db, t)
	setInitCtxSignedInOrgAdmin(sc.initCtx)
	sc.initCtx.SignedInUser.Login = users[0].Login

	t.Run("Organisation admins can list team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(teamMemberGetRoute, "1"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
		var resp []models.TeamMemberDTO
		err := json.Unmarshal(response.Body.Bytes(), &resp)
		require.NoError(t, err)
		require.Len(t, resp, teamMemberCount, "the correct number of team members is returned")
	})

	sc.cfg.HiddenUsers = map[string]struct{}{
		users[1].Login:                {},
		sc.initCtx.SignedInUser.Login: {},
	}

	t.Run("Organisation admins can not see hidden team members apart from themselves", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(teamMemberGetRoute, "1"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
		var resp []models.TeamMemberDTO
		err := json.Unmarshal(response.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Len(t, resp, teamMemberCount-1, "organisation admins should only see non-hidden users and themselves")
		assert.Equal(t, users[0].Login, resp[0].Login)
		assert.Equal(t, users[2].Login, resp[1].Login)
	})

	sc.initCtx.IsGrafanaAdmin = true
	t.Run("Server admins can list all hidden team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(teamMemberGetRoute, "1"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
		var resp []models.TeamMemberDTO
		err := json.Unmarshal(response.Body.Bytes(), &resp)
		require.NoError(t, err)
		require.Len(t, resp, teamMemberCount, "the correct number of team members is returned")
	})
}

func TestListTeamMembersAPIEndpoint_FGAC(t *testing.T) {
	sc := setupHTTPServer(t, true, true)
	sc.hs.License = &licensing.OSSLicensingService{}

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Access control allows listing team members with the right permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(teamMemberGetRoute, "1"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
		var resp []models.TeamMemberDTO
		err := json.Unmarshal(response.Body.Bytes(), &resp)
		require.NoError(t, err)
		require.Len(t, resp, teamMemberCount, "the correct number of team members is returned")
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	t.Run("Access control prevents listing team members with incorrect permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(teamMemberGetRoute, "1"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("Access control prevents listing team members with incorrect scope", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsRead, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodGet, fmt.Sprintf(teamMemberGetRoute, "1"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestAddTeamMembersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.EditorsCanAdmin = true
	sc := setupHTTPServerWithCfg(t, true, false, cfg)
	guardian := manager.ProvideService(database.ProvideTeamGuardianStore())
	sc.hs.teamGuardian = guardian

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	newUser := createUser(sc.db, t)
	input := strings.NewReader(fmt.Sprintf(createTeamMemberCmd, newUser.Id))
	t.Run("Organisation admins can add a team member", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInEditor(sc.initCtx)
	sc.initCtx.IsGrafanaAdmin = true
	newUser = createUser(sc.db, t)
	input = strings.NewReader(fmt.Sprintf(createTeamMemberCmd, newUser.Id))
	t.Run("Editors cannot add team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	err := sc.db.SaveTeamMember(sc.initCtx.UserId, 1, 1, false, 0)
	require.NoError(t, err)
	input = strings.NewReader(fmt.Sprintf(createTeamMemberCmd, newUser.Id))
	t.Run("Team members cannot add team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	err = sc.db.SaveTeamMember(sc.initCtx.UserId, 1, 1, false, models.PERMISSION_ADMIN)
	require.NoError(t, err)
	input = strings.NewReader(fmt.Sprintf(createTeamMemberCmd, newUser.Id))
	t.Run("Team admins can add a team member", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestAddTeamMembersAPIEndpoint_FGAC(t *testing.T) {
	sc := setupHTTPServer(t, true, true)

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInViewer(sc.initCtx)
	newUser := createUser(sc.db, t)
	input := strings.NewReader(fmt.Sprintf(createTeamMemberCmd, newUser.Id))
	t.Run("Access control allows adding a team member with the right permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	newUser = createUser(sc.db, t)
	input = strings.NewReader(fmt.Sprintf(createTeamCmd, newUser.Id))
	t.Run("Access control prevents from adding a team member with the wrong permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Access control prevents adding a team member with incorrect scope", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodPost, fmt.Sprintf(teamMemberAddRoute, "1"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestUpdateTeamMembersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.EditorsCanAdmin = true
	sc := setupHTTPServerWithCfg(t, true, false, cfg)
	guardian := manager.ProvideService(database.ProvideTeamGuardianStore())
	sc.hs.teamGuardian = guardian

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	input := strings.NewReader(fmt.Sprintf(updateTeamMemberCmd, models.PERMISSION_ADMIN))
	t.Run("Organisation admins can update a team member", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInEditor(sc.initCtx)
	sc.initCtx.IsGrafanaAdmin = true
	input = strings.NewReader(fmt.Sprintf(updateTeamMemberCmd, 0))
	t.Run("Editors cannot update team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	err := sc.db.SaveTeamMember(sc.initCtx.UserId, 1, 1, false, 0)
	require.NoError(t, err)
	input = strings.NewReader(fmt.Sprintf(updateTeamMemberCmd, 0))
	t.Run("Team members cannot update team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	err = sc.db.SaveTeamMember(sc.initCtx.UserId, 1, 1, false, models.PERMISSION_ADMIN)
	require.NoError(t, err)
	input = strings.NewReader(fmt.Sprintf(updateTeamMemberCmd, 0))
	t.Run("Team admins can update a team member", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestUpdateTeamMembersAPIEndpoint_FGAC(t *testing.T) {
	sc := setupHTTPServer(t, true, true)

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInViewer(sc.initCtx)
	input := strings.NewReader(fmt.Sprintf(updateTeamMemberCmd, models.PERMISSION_ADMIN))
	t.Run("Access control allows updating a team member with the right permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	input = strings.NewReader(fmt.Sprintf(updateTeamMemberCmd, models.PERMISSION_ADMIN))
	t.Run("Access control prevents updating a team member with the wrong permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Access control prevents updating a team member with incorrect scope", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodPut, fmt.Sprintf(teamMemberUpdateRoute, "1", "2"), input, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}

func TestDeleteTeamMembersAPIEndpoint_LegacyAccessControl(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.EditorsCanAdmin = true
	sc := setupHTTPServerWithCfg(t, true, false, cfg)
	guardian := manager.ProvideService(database.ProvideTeamGuardianStore())
	sc.hs.teamGuardian = guardian

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	t.Run("Organisation admins can remove a team member", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "2"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInEditor(sc.initCtx)
	sc.initCtx.IsGrafanaAdmin = true
	t.Run("Editors cannot remove team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "3"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	err := sc.db.SaveTeamMember(sc.initCtx.UserId, 1, 1, false, 0)
	require.NoError(t, err)
	t.Run("Team members cannot remove team members", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "3"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	err = sc.db.SaveTeamMember(sc.initCtx.UserId, 1, 1, false, models.PERMISSION_ADMIN)
	require.NoError(t, err)
	t.Run("Team admins can remove a team member", func(t *testing.T) {
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "3"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})
}

func TestDeleteTeamMembersAPIEndpoint_FGAC(t *testing.T) {
	sc := setupHTTPServer(t, true, true)

	teamMemberCount := 3
	setupTeamTestScenario(teamMemberCount, sc.db, t)

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Access control allows removing a team member with the right permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsWrite, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "2"), nil, t)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	setInitCtxSignedInOrgAdmin(sc.initCtx)
	t.Run("Access control prevents removing a team member with the wrong permissions", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsRead, Scope: "teams:id:1"}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "3"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	setInitCtxSignedInViewer(sc.initCtx)
	t.Run("Access control prevents removing a team member with incorrect scope", func(t *testing.T) {
		setAccessControlPermissions(sc.acmock, []*accesscontrol.Permission{{Action: ActionTeamsPermissionsWrite, Scope: "teams:id:2"}}, 1)
		response := callAPI(sc.server, http.MethodDelete, fmt.Sprintf(teamMemberDeleteRoute, "1", "3"), nil, t)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})
}
