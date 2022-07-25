package guardian

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"
)

type scenarioContext struct {
	t                  *testing.T
	orgRoleScenario    string
	permissionScenario string
	g                  DashboardGuardian
	givenUser          *models.SignedInUser
	givenDashboardID   int64
	givenPermissions   []*models.DashboardACLInfoDTO
	givenTeams         []*models.TeamDTO
	updatePermissions  []*models.DashboardACL
	expectedFlags      permissionFlags
	callerFile         string
	callerLine         int
}

type scenarioFunc func(c *scenarioContext)

func orgRoleScenario(desc string, t *testing.T, role models.RoleType, fn scenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		user := &models.SignedInUser{
			UserId:  userID,
			OrgId:   orgID,
			OrgRole: role,
		}
		store := mockstore.NewSQLStoreMock()
		guard := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, &dashboards.FakeDashboardService{})

		sc := &scenarioContext{
			t:                t,
			orgRoleScenario:  desc,
			givenUser:        user,
			givenDashboardID: dashboardID,
			g:                guard,
		}
		fn(sc)
	})
}

func apiKeyScenario(desc string, t *testing.T, role models.RoleType, fn scenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		user := &models.SignedInUser{
			UserId:   0,
			OrgId:    orgID,
			OrgRole:  role,
			ApiKeyId: 10,
		}
		store := mockstore.NewSQLStoreMock()
		guard := newDashboardGuardian(context.Background(), dashboardID, orgID, user, store, &dashboards.FakeDashboardService{})
		sc := &scenarioContext{
			t:                t,
			orgRoleScenario:  desc,
			givenUser:        user,
			givenDashboardID: dashboardID,
			g:                guard,
		}

		fn(sc)
	})
}

func permissionScenario(desc string, dashboardID int64, sc *scenarioContext,
	permissions []*models.DashboardACLInfoDTO, fn scenarioFunc) {
	sc.t.Run(desc, func(t *testing.T) {
		store := mockstore.NewSQLStoreMock()
		teams := []*models.TeamDTO{}

		for _, p := range permissions {
			if p.TeamId > 0 {
				teams = append(teams, &models.TeamDTO{Id: p.TeamId})
			}
		}
		store.ExpectedTeamsByUser = teams

		dashSvc := dashboards.NewFakeDashboardService(t)
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*models.GetDashboardACLInfoListQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardACLInfoListQuery)
			q.Result = permissions
		}).Return(nil)

		sc.permissionScenario = desc
		sc.g = newDashboardGuardian(context.Background(), dashboardID, sc.givenUser.OrgId, sc.givenUser, store, dashSvc)
		sc.givenDashboardID = dashboardID
		sc.givenPermissions = permissions
		sc.givenTeams = teams

		fn(sc)
	})
}

type permissionType uint8

const (
	USER permissionType = 1 << iota
	TEAM
	EDITOR
	VIEWER
)

func (p permissionType) String() string {
	names := map[uint8]string{
		uint8(USER):   "user",
		uint8(TEAM):   "team",
		uint8(EDITOR): "editor role",
		uint8(VIEWER): "viewer role",
	}
	return names[uint8(p)]
}

type permissionFlags uint8

const (
	NO_ACCESS permissionFlags = 1 << iota
	CAN_ADMIN
	CAN_EDIT
	CAN_SAVE
	CAN_VIEW
	FULL_ACCESS   = CAN_ADMIN | CAN_EDIT | CAN_SAVE | CAN_VIEW
	EDITOR_ACCESS = CAN_EDIT | CAN_SAVE | CAN_VIEW
	VIEWER_ACCESS = CAN_VIEW
)

func (f permissionFlags) canAdmin() bool {
	return f&CAN_ADMIN != 0
}

func (f permissionFlags) canEdit() bool {
	return f&CAN_EDIT != 0
}

func (f permissionFlags) canSave() bool {
	return f&CAN_SAVE != 0
}

func (f permissionFlags) canView() bool {
	return f&CAN_VIEW != 0
}

func (f permissionFlags) noAccess() bool {
	return f&(CAN_ADMIN|CAN_EDIT|CAN_SAVE|CAN_VIEW) == 0
}

func (f permissionFlags) String() string {
	r := []string{}

	if f.canAdmin() {
		r = append(r, "admin")
	}

	if f.canEdit() {
		r = append(r, "edit")
	}

	if f.canSave() {
		r = append(r, "save")
	}

	if f.canView() {
		r = append(r, "view")
	}

	if f.noAccess() {
		r = append(r, "<no access>")
	}

	return strings.Join(r, ", ")
}

func (sc *scenarioContext) reportSuccess() {
	assert.True(sc.t, true)
}

func (sc *scenarioContext) reportFailure(desc string, expected interface{}, actual interface{}) {
	var buf bytes.Buffer
	buf.WriteString("\n")
	buf.WriteString(sc.orgRoleScenario)
	buf.WriteString(" ")
	buf.WriteString(sc.permissionScenario)
	buf.WriteString("\n  ")
	buf.WriteString(desc)
	buf.WriteString("\n")
	buf.WriteString(fmt.Sprintf("Source test: %s:%d\n", sc.callerFile, sc.callerLine))
	buf.WriteString(fmt.Sprintf("Expected: %v\n", expected))
	buf.WriteString(fmt.Sprintf("Actual: %v\n", actual))
	buf.WriteString("Context:")
	buf.WriteString(fmt.Sprintf("\n  Given user: orgRole=%s, id=%d, orgId=%d", sc.givenUser.OrgRole, sc.givenUser.UserId, sc.givenUser.OrgId))
	buf.WriteString(fmt.Sprintf("\n  Given dashboard id: %d", sc.givenDashboardID))

	for i, p := range sc.givenPermissions {
		r := "<nil>"
		if p.Role != nil {
			r = string(*p.Role)
		}
		buf.WriteString(fmt.Sprintf("\n  Given permission (%d): dashboardId=%d, userId=%d, teamId=%d, role=%v, permission=%s", i, p.DashboardId, p.UserId, p.TeamId, r, p.Permission.String()))
	}

	for i, t := range sc.givenTeams {
		buf.WriteString(fmt.Sprintf("\n  Given team (%d): id=%d", i, t.Id))
	}

	for i, p := range sc.updatePermissions {
		r := "<nil>"
		if p.Role != nil {
			r = string(*p.Role)
		}
		buf.WriteString(fmt.Sprintf("\n  Update permission (%d): dashboardId=%d, userId=%d, teamId=%d, role=%v, permission=%s", i, p.DashboardID, p.UserID, p.TeamID, r, p.Permission.String()))
	}

	sc.t.Fatalf(buf.String())
}

func newCustomUserPermission(dashboardID int64, userID int64, permission models.PermissionType) *models.DashboardACL {
	return &models.DashboardACL{OrgID: orgID, DashboardID: dashboardID, UserID: userID, Permission: permission}
}

func newDefaultUserPermission(dashboardID int64, permission models.PermissionType) *models.DashboardACL {
	return newCustomUserPermission(dashboardID, userID, permission)
}

func newCustomTeamPermission(dashboardID int64, teamID int64, permission models.PermissionType) *models.DashboardACL {
	return &models.DashboardACL{OrgID: orgID, DashboardID: dashboardID, TeamID: teamID, Permission: permission}
}

func newDefaultTeamPermission(dashboardID int64, permission models.PermissionType) *models.DashboardACL {
	return newCustomTeamPermission(dashboardID, teamID, permission)
}

func newAdminRolePermission(dashboardID int64, permission models.PermissionType) *models.DashboardACL {
	return &models.DashboardACL{OrgID: orgID, DashboardID: dashboardID, Role: &adminRole, Permission: permission}
}

func newEditorRolePermission(dashboardID int64, permission models.PermissionType) *models.DashboardACL {
	return &models.DashboardACL{OrgID: orgID, DashboardID: dashboardID, Role: &editorRole, Permission: permission}
}

func newViewerRolePermission(dashboardID int64, permission models.PermissionType) *models.DashboardACL {
	return &models.DashboardACL{OrgID: orgID, DashboardID: dashboardID, Role: &viewerRole, Permission: permission}
}

func toDto(acl *models.DashboardACL) *models.DashboardACLInfoDTO {
	return &models.DashboardACLInfoDTO{
		OrgId:          acl.OrgID,
		DashboardId:    acl.DashboardID,
		UserId:         acl.UserID,
		TeamId:         acl.TeamID,
		Role:           acl.Role,
		Permission:     acl.Permission,
		PermissionName: acl.Permission.String(),
	}
}
