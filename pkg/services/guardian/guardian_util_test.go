package guardian

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type scenarioContext struct {
	t                  *testing.T
	orgRoleScenario    string
	permissionScenario string
	g                  DashboardGuardian
	givenUser          *user.SignedInUser
	givenDashboardID   int64
	givenPermissions   []*dashboards.DashboardACLInfoDTO
	givenTeams         []*team.TeamDTO
	updatePermissions  []*dashboards.DashboardACL
	expectedFlags      permissionFlags
	callerFile         string
	callerLine         int
}

type scenarioFunc func(c *scenarioContext)

func orgRoleScenario(desc string, t *testing.T, role org.RoleType, fn scenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		user := &user.SignedInUser{
			UserID:  userID,
			OrgID:   orgID,
			OrgRole: role,
		}
		store := dbtest.NewFakeDB()

		fakeDashboardService := dashboards.NewFakeDashboardService(t)
		var qResult *dashboards.Dashboard
		fakeDashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*dashboards.GetDashboardQuery)
			qResult = &dashboards.Dashboard{
				ID:  q.ID,
				UID: q.UID,
			}
		}).Return(qResult, nil)
		guard, err := newDashboardGuardian(context.Background(), setting.NewCfg(), dashboardID, orgID, user, store, fakeDashboardService, &teamtest.FakeService{})
		require.NoError(t, err)

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

func apiKeyScenario(desc string, t *testing.T, role org.RoleType, fn scenarioFunc) {
	t.Run(desc, func(t *testing.T) {
		user := &user.SignedInUser{
			UserID:   0,
			OrgID:    orgID,
			OrgRole:  role,
			ApiKeyID: 10,
		}
		store := dbtest.NewFakeDB()
		dashSvc := dashboards.NewFakeDashboardService(t)
		var qResult *dashboards.Dashboard
		dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*dashboards.GetDashboardQuery)
			qResult = &dashboards.Dashboard{
				ID:  q.ID,
				UID: q.UID,
			}
		}).Return(qResult, nil)
		guard, err := newDashboardGuardian(context.Background(), setting.NewCfg(), dashboardID, orgID, user, store, dashSvc, &teamtest.FakeService{})
		require.NoError(t, err)

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
	permissions []*dashboards.DashboardACLInfoDTO, fn scenarioFunc) {
	sc.t.Run(desc, func(t *testing.T) {
		store := dbtest.NewFakeDB()
		teams := []*team.TeamDTO{}

		for _, p := range permissions {
			if p.TeamID > 0 {
				teams = append(teams, &team.TeamDTO{ID: p.TeamID})
			}
		}
		teamSvc := &teamtest.FakeService{ExpectedTeamsByUser: teams}

		dashSvc := dashboards.NewFakeDashboardService(t)
		qResult := permissions
		dashSvc.On("GetDashboardACLInfoList", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardACLInfoListQuery")).Return(qResult, nil)
		qResultDash := &dashboards.Dashboard{}
		dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*dashboards.GetDashboardQuery)
			qResultDash = &dashboards.Dashboard{
				ID:    q.ID,
				UID:   q.UID,
				OrgID: q.OrgID,
			}
		}).Return(qResultDash, nil)

		sc.permissionScenario = desc
		g, err := newDashboardGuardian(context.Background(), setting.NewCfg(), dashboardID, sc.givenUser.OrgID, sc.givenUser, store, dashSvc, teamSvc)
		require.NoError(t, err)
		sc.g = g

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
	buf.WriteString(fmt.Sprintf("\n  Given user: orgRole=%s, id=%d, orgId=%d", sc.givenUser.OrgRole, sc.givenUser.UserID, sc.givenUser.OrgID))
	buf.WriteString(fmt.Sprintf("\n  Given dashboard id: %d", sc.givenDashboardID))

	for i, p := range sc.givenPermissions {
		r := "<nil>"
		if p.Role != nil {
			r = string(*p.Role)
		}
		buf.WriteString(fmt.Sprintf("\n  Given permission (%d): dashboardId=%d, userId=%d, teamId=%d, role=%v, permission=%s", i, p.DashboardID, p.UserID, p.TeamID, r, p.Permission.String()))
	}

	for i, t := range sc.givenTeams {
		buf.WriteString(fmt.Sprintf("\n  Given team (%d): id=%d", i, t.ID))
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

func newCustomUserPermission(dashboardID int64, userID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return &dashboards.DashboardACL{OrgID: orgID, DashboardID: dashboardID, UserID: userID, Permission: permission}
}

func newDefaultUserPermission(dashboardID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return newCustomUserPermission(dashboardID, userID, permission)
}

func newCustomTeamPermission(dashboardID int64, teamID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return &dashboards.DashboardACL{OrgID: orgID, DashboardID: dashboardID, TeamID: teamID, Permission: permission}
}

func newDefaultTeamPermission(dashboardID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return newCustomTeamPermission(dashboardID, teamID, permission)
}

func newAdminRolePermission(dashboardID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return &dashboards.DashboardACL{OrgID: orgID, DashboardID: dashboardID, Role: &adminRole, Permission: permission}
}

func newEditorRolePermission(dashboardID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return &dashboards.DashboardACL{OrgID: orgID, DashboardID: dashboardID, Role: &editorRole, Permission: permission}
}

func newViewerRolePermission(dashboardID int64, permission dashboards.PermissionType) *dashboards.DashboardACL {
	return &dashboards.DashboardACL{OrgID: orgID, DashboardID: dashboardID, Role: &viewerRole, Permission: permission}
}

func toDto(acl *dashboards.DashboardACL) *dashboards.DashboardACLInfoDTO {
	return &dashboards.DashboardACLInfoDTO{
		OrgID:          acl.OrgID,
		DashboardID:    acl.DashboardID,
		UserID:         acl.UserID,
		TeamID:         acl.TeamID,
		Role:           acl.Role,
		Permission:     acl.Permission,
		PermissionName: acl.Permission.String(),
	}
}
