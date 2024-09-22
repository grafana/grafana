package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	ngModels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// TestDashAlertPermissionMigration tests the execution of the migration specifically for dashboards with custom permissions.
//
//nolint:gocyclo
func TestDashAlertPermissionMigration(t *testing.T) {
	genLegacyAlert := func(name string, dashboardId int64, mutators ...func(*models.Alert)) *models.Alert {
		a := createAlert(t, 1, int(dashboardId), 1, name, nil)
		if len(mutators) > 0 {
			for _, mutator := range mutators {
				mutator(a)
			}
		}
		return a
	}

	genAlert := func(title string, namespaceUID string, dashboardUID string, mutators ...func(*ngModels.AlertRule)) *ngModels.AlertRule {
		dashTitle := "Dashboard Title " + dashboardUID
		a := &ngModels.AlertRule{
			ID:        1,
			OrgID:     1,
			Title:     title,
			Condition: "A",
			Data: []ngModels.AlertQuery{
				{
					RefID:         "A",
					DatasourceUID: "__expr__",
					Model:         json.RawMessage(`{"conditions":[],"intervalMs":1000,"maxDataPoints":43200,"refId":"A","type":"classic_conditions"}`),
				},
			},
			NamespaceUID:    namespaceUID,
			DashboardUID:    &dashboardUID,
			RuleGroup:       fmt.Sprintf("%s - 1m", dashTitle),
			IntervalSeconds: 60,
			Version:         1,
			PanelID:         pointer(int64(1)),
			RuleGroupIndex:  1,
			NoDataState:     ngModels.NoData,
			ExecErrState:    ngModels.AlertingErrState,
			For:             60 * time.Second,
			Annotations: map[string]string{
				"message":          "message",
				"__dashboardUid__": dashboardUID,
				"__panelId__":      "1",
			},
			Labels:   map[string]string{ngModels.MigratedUseLegacyChannelsLabel: "true"},
			IsPaused: false,
		}
		if len(mutators) > 0 {
			for _, mutator := range mutators {
				mutator(a)
			}
		}
		return a
	}

	withPanelId := func(id int64) func(*ngModels.AlertRule) {
		return func(a *ngModels.AlertRule) {
			a.PanelID = pointer(id)
			a.Annotations["__panelId__"] = fmt.Sprintf("%d", id)
		}
	}

	genFolder := func(t *testing.T, id int64, uid string, mutators ...func(f *dashboards.Dashboard)) *dashboards.Dashboard {
		d := createFolder(t, id, 1, uid)
		d.Title = "Original Folder " + uid
		if len(mutators) > 0 {
			for _, mutator := range mutators {
				mutator(d)
			}
		}
		return d
	}

	genCreatedFolder := func(t *testing.T, title string, mutators ...func(f *dashboards.Dashboard)) *dashboards.Dashboard {
		d := createFolder(t, 1, 1, "") // Leave generated UID blank, so we don't compare.
		d.Title = title
		d.CreatedBy = -1
		d.UpdatedBy = -1
		if len(mutators) > 0 {
			for _, mutator := range mutators {
				mutator(d)
			}
		}
		return d
	}

	genDashboard := func(t *testing.T, id int64, uid, folderUID string, folderId int64, mutators ...func(f *dashboards.Dashboard)) *dashboards.Dashboard {
		d := createDashboard(t, id, 1, uid, folderUID, folderId, nil)
		d.Title = "Dashboard Title " + uid
		if len(mutators) > 0 {
			for _, mutator := range mutators {
				mutator(d)
			}
		}
		return d
	}

	genPerms := func(perms ...accesscontrol.SetResourcePermissionCommand) []accesscontrol.SetResourcePermissionCommand {
		return perms
	}

	type expectedAlertMigration struct {
		Alert  *ngModels.AlertRule
		Folder *dashboards.Dashboard
		Perms  []accesscontrol.SetResourcePermissionCommand
	}

	type testcase struct {
		name           string
		enterprise     bool
		folders        []*dashboards.Dashboard
		folderPerms    map[string][]accesscontrol.SetResourcePermissionCommand // UID -> Perms
		dashboards     []*dashboards.Dashboard
		dashboardPerms map[string][]accesscontrol.SetResourcePermissionCommand // UID -> Perms
		alerts         []*models.Alert
		roles          map[accesscontrol.Role][]accesscontrol.Permission

		expected []expectedAlertMigration
	}

	// Used to perform the same tests for each of builtins, users, and teams.
	splitTestcase := func(raw testcase) []testcase {
		permTypes := make(map[string]func(accesscontrol.SetResourcePermissionCommand) accesscontrol.SetResourcePermissionCommand, 3)
		permTypes["builtins"] = func(p accesscontrol.SetResourcePermissionCommand) accesscontrol.SetResourcePermissionCommand {
			return p
		}
		mapping := map[string]int64{
			string(org.RoleEditor): 1,
			string(org.RoleViewer): 2,
		}
		permTypes["users"] = func(p accesscontrol.SetResourcePermissionCommand) accesscontrol.SetResourcePermissionCommand {
			id, ok := mapping[p.BuiltinRole]
			if !ok {
				return p
			}
			p.UserID = id
			p.BuiltinRole = ""
			return p
		}
		permTypes["teams"] = func(p accesscontrol.SetResourcePermissionCommand) accesscontrol.SetResourcePermissionCommand {
			id, ok := mapping[p.BuiltinRole]
			if !ok {
				return p
			}
			p.TeamID = id
			p.BuiltinRole = ""
			return p
		}

		applyTransform := func(tt testcase, pfunc func(p accesscontrol.SetResourcePermissionCommand) accesscontrol.SetResourcePermissionCommand) testcase {
			folderPerms := make(map[string][]accesscontrol.SetResourcePermissionCommand, len(tt.folderPerms))
			for _, f := range tt.folders {
				perms := make([]accesscontrol.SetResourcePermissionCommand, 0, len(tt.folderPerms[f.UID]))
				for _, p := range tt.folderPerms[f.UID] {
					perms = append(perms, pfunc(p))
				}
				folderPerms[f.UID] = perms
			}
			tt.folderPerms = folderPerms

			dashboardPerms := make(map[string][]accesscontrol.SetResourcePermissionCommand, len(tt.dashboardPerms))
			for _, d := range tt.dashboards {
				perms := make([]accesscontrol.SetResourcePermissionCommand, 0, len(tt.dashboardPerms[d.UID]))
				for _, p := range tt.dashboardPerms[d.UID] {
					perms = append(perms, pfunc(p))
				}
				dashboardPerms[d.UID] = perms
			}
			tt.dashboardPerms = dashboardPerms

			expected := make([]expectedAlertMigration, 0, len(tt.expected))
			for _, ex := range tt.expected {
				permissions := make([]accesscontrol.SetResourcePermissionCommand, 0, len(ex.Perms))
				for _, p := range ex.Perms {
					permissions = append(permissions, pfunc(p))
				}
				ex.Perms = permissions

				sort.SliceStable(permissions, func(i, j int) bool {
					if permissions[i].BuiltinRole != permissions[j].BuiltinRole {
						return permissions[i].BuiltinRole < permissions[j].BuiltinRole
					}
					if permissions[i].UserID != permissions[j].UserID {
						return permissions[i].UserID < permissions[j].UserID
					}
					if permissions[i].TeamID != permissions[j].TeamID {
						return permissions[i].TeamID < permissions[j].TeamID
					}
					return permissions[i].Permission < permissions[j].Permission
				})

				f := *ex.Folder
				if strings.Contains(f.Title, "%s") {
					hash, err := createHash(permissions)
					require.NoError(t, err)
					f.Title = fmt.Sprintf(f.Title, hash)
				}

				expected = append(expected, expectedAlertMigration{
					Alert:  ex.Alert,
					Folder: &f,
					Perms:  permissions,
				})
			}
			tt.expected = expected

			return tt
		}

		cases := make([]testcase, 0, 3)
		for k, pfunc := range permTypes {
			tt := applyTransform(raw, pfunc)
			tt.name = k
			cases = append(cases, tt)
		}
		return cases
	}

	basicFolder := genFolder(t, 1, "f_1")
	basicDashboard := genDashboard(t, 2, "d_1", basicFolder.UID, basicFolder.ID)
	defaultPerms := genPerms(
		accesscontrol.SetResourcePermissionCommand{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
		accesscontrol.SetResourcePermissionCommand{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
	)

	basicAlert1 := genLegacyAlert("alert1", basicDashboard.ID, func(a *models.Alert) { a.PanelID = 1 })
	basicAlert2 := genLegacyAlert("alert2", basicDashboard.ID, func(a *models.Alert) { a.PanelID = 2 })

	basicPerms := func() map[accesscontrol.Role][]accesscontrol.Permission {
		basic := make(map[accesscontrol.Role][]accesscontrol.Permission)
		var permissions []accesscontrol.Permission
		ts := time.Now()
		for _, action := range append(ossaccesscontrol.DashboardAdminActions, ossaccesscontrol.FolderAdminActions...) {
			if isDashboardAction := strings.HasPrefix(action, "dashboards"); isDashboardAction {
				permissions = append(permissions, accesscontrol.Permission{
					Action:  action,
					Scope:   dashboards.ScopeDashboardsAll,
					Created: ts,
					Updated: ts,
				})
			}
			permissions = append(permissions, accesscontrol.Permission{
				Action:  action,
				Scope:   dashboards.ScopeFoldersAll,
				Created: ts,
				Updated: ts,
			})
		}
		basic[accesscontrol.Role{Name: accesscontrol.BasicRolePrefix + "admin"}] = permissions
		return basic
	}

	tc := []testcase{
		{
			name:           "alerts in dashboard and folder with default permissions migrate to same folder",
			folders:        []*dashboards.Dashboard{basicFolder},
			folderPerms:    map[string][]accesscontrol.SetResourcePermissionCommand{basicFolder.UID: defaultPerms},
			dashboards:     []*dashboards.Dashboard{basicDashboard},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{basicDashboard.UID: defaultPerms},
			alerts:         []*models.Alert{basicAlert1, basicAlert2},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert(basicAlert1.Name, basicFolder.UID, basicDashboard.UID, withPanelId(basicAlert1.PanelID)),
					Folder: basicFolder,
					Perms:  defaultPerms,
				},
				{
					Alert:  genAlert(basicAlert2.Name, basicFolder.UID, basicDashboard.UID, withPanelId(basicAlert2.PanelID)),
					Folder: basicFolder,
					Perms:  defaultPerms,
				},
			},
		},
		{
			name:        "dashboard override cannot lessen folder permissions",
			folders:     []*dashboards.Dashboard{basicFolder},
			folderPerms: map[string][]accesscontrol.SetResourcePermissionCommand{basicFolder.UID: defaultPerms},
			dashboards:  []*dashboards.Dashboard{basicDashboard},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				basicDashboard.UID: {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_VIEW.String()}, // Change.
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
			},
			alerts: []*models.Alert{basicAlert1},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert(basicAlert1.Name, basicFolder.UID, basicDashboard.UID),
					Folder: basicFolder,
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // Inherits from Folder.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
					},
				},
			},
		},
		{
			name:        "dashboard with various permission overrides should create new folder",
			folders:     []*dashboards.Dashboard{basicFolder},
			folderPerms: map[string][]accesscontrol.SetResourcePermissionCommand{basicFolder.UID: defaultPerms},
			dashboards: []*dashboards.Dashboard{
				genDashboard(t, 2, "d_1", basicFolder.UID, basicFolder.ID),
				genDashboard(t, 3, "d_2", basicFolder.UID, basicFolder.ID),
				genDashboard(t, 4, "d_3", basicFolder.UID, basicFolder.ID),
				genDashboard(t, 5, "d_4", basicFolder.UID, basicFolder.ID),
				genDashboard(t, 6, "d_5", basicFolder.UID, basicFolder.ID),
			},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				"d_1": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // Change.
				},
				"d_2": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
				},
				"d_3": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_EDIT.String()},  // Change.
				},
				"d_4": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
				"d_5": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
				},
			},
			alerts: []*models.Alert{genLegacyAlert("alert1", 2), genLegacyAlert("alert2", 3), genLegacyAlert("alert3", 4), genLegacyAlert("alert4", 5), genLegacyAlert("alert5", 6)},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert("alert1", "", "d_1"),
					Folder: genCreatedFolder(t, "Original Folder f_1 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // Change.
					},
				},
				{
					Alert:  genAlert("alert2", "", "d_2"),
					Folder: genCreatedFolder(t, "Original Folder f_1 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
					},
				},
				{
					Alert:  genAlert("alert3", "", "d_3"),
					Folder: genCreatedFolder(t, "Original Folder f_1 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_EDIT.String()},  // Change.
					},
				},
				{
					Alert:  genAlert("alert4", "", "d_4"),
					Folder: genCreatedFolder(t, "Original Folder f_1 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
					},
				},
				{
					Alert:  genAlert("alert5", "", "d_5"),
					Folder: genCreatedFolder(t, "Original Folder f_1 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Change.
					},
				},
			},
		},
		{
			name:    "missing dashboard permission is inherited from folder",
			folders: []*dashboards.Dashboard{genFolder(t, 1, "f_1"), genFolder(t, 2, "f_2")},
			folderPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				"f_1": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()},
				},
				"f_2": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_VIEW.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
			},
			dashboards: []*dashboards.Dashboard{
				genDashboard(t, 3, "d_1", "1", 1),
				genDashboard(t, 4, "d_2", "1", 1),
				genDashboard(t, 5, "d_3", "2", 2),
				genDashboard(t, 6, "d_4", "2", 2),
			},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				"d_1": {
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
				"d_2": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
				},
				"d_3": {
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
				"d_4": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
				},
			},
			alerts: []*models.Alert{genLegacyAlert("alert1", 3), genLegacyAlert("alert2", 4), genLegacyAlert("alert3", 5), genLegacyAlert("alert4", 6)},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert("alert1", "f_1", "d_1"),
					Folder: genFolder(t, 1, "f_1"), // Original folder since the perms didn't change.
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Inherits from Folder.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Overrides from Folder.
					},
				},
				{
					Alert:  genAlert("alert2", "f_1", "d_2"),
					Folder: genFolder(t, 1, "f_1"), // Original folder since the perms didn't change.
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Overrides from Folder.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // Inherits from Folder.
					},
				},
				{
					Alert:  genAlert("alert3", "f_2", "d_3"),
					Folder: genFolder(t, 2, "f_2"), // Original folder since the perms didn't change.
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_VIEW.String()}, // Inherits from Folder.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()},
					},
				},
				{
					Alert:  genAlert("alert4", "", "d_4"),
					Folder: genCreatedFolder(t, "Original Folder f_2 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()}, // Inherits from Folder.
					},
				},
			},
		},
		{
			name:    "missing dashboard and folder view permission is still missing",
			folders: []*dashboards.Dashboard{basicFolder},
			folderPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				basicFolder.UID: {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
				},
			},
			dashboards: []*dashboards.Dashboard{basicDashboard},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				basicDashboard.UID: {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_VIEW.String()},
				},
			},
			alerts: []*models.Alert{basicAlert1},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert(basicAlert1.Name, basicFolder.UID, basicDashboard.UID),
					Folder: basicFolder,
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
					},
				},
			},
		},

		// General folder.
		{
			name:       "dashboard in general folder with default permissions migrates to General Alerting subfolder for permission",
			dashboards: []*dashboards.Dashboard{genDashboard(t, 1, "d_1", "", 0)}, // Dashboard in general folder.
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				"d_1": defaultPerms,
			},
			alerts: []*models.Alert{genLegacyAlert("alert1", 1)},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert("alert1", "f_1", "d_1"),
					Folder: genCreatedFolder(t, "General Alerting Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // From Dashboard.
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_VIEW.String()}, // From Dashboard.
					},
				},
			},
		},
		{
			name:       "dashboard in general folder with some perms migrates to General Alerting subfolder with correct permissions",
			dashboards: []*dashboards.Dashboard{genDashboard(t, 1, "d_1", "", 0)}, // Dashboard in general folder.
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				"d_1": { // Missing viewer.
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
				},
			},
			alerts: []*models.Alert{genLegacyAlert("alert1", 1)},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert("alert1", "f_1", "d_1"),
					Folder: genCreatedFolder(t, "General Alerting Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // From Dashboard.
					},
				},
			},
		},
		{
			name:       "dashboard in general folder with empty perms migrates to General Alerting",
			dashboards: []*dashboards.Dashboard{genDashboard(t, 1, "d_1", "", 0)}, // Dashboard in general folder.
			alerts:     []*models.Alert{genLegacyAlert("alert1", 1)},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert("alert1", "f_1", "d_1"),
					Folder: genCreatedFolder(t, "General Alerting"),
					Perms:  []accesscontrol.SetResourcePermissionCommand{},
				},
			},
		},

		// The following tests handled extra requirements of enterprise RBAC in that they include basic, fixed, and custom roles.
		{
			name:        "should handle basic roles the same as managed builtin roles",
			enterprise:  true,
			roles:       basicPerms(),
			folders:     []*dashboards.Dashboard{basicFolder},
			folderPerms: map[string][]accesscontrol.SetResourcePermissionCommand{basicFolder.UID: defaultPerms},
			dashboards: []*dashboards.Dashboard{
				genDashboard(t, 2, "d_1", basicFolder.UID, basicFolder.ID),
			},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{
				"d_1": {
					{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
					{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // Change.
				},
			},
			alerts: []*models.Alert{genLegacyAlert("alert1", 2)},
			expected: []expectedAlertMigration{
				{
					Alert:  genAlert("alert1", "", "d_1"),
					Folder: genCreatedFolder(t, "Original Folder f_1 Alerts - %s"),
					Perms: []accesscontrol.SetResourcePermissionCommand{
						{BuiltinRole: string(org.RoleAdmin), Permission: dashboardaccess.PERMISSION_ADMIN.String()}, // From basic:admin.
						{BuiltinRole: string(org.RoleEditor), Permission: dashboardaccess.PERMISSION_EDIT.String()},
						{BuiltinRole: string(org.RoleViewer), Permission: dashboardaccess.PERMISSION_EDIT.String()}, // Change.
					},
				},
			},
		},
		{
			name:       "should ignore fixed roles even if they would affect access",
			enterprise: true,
			roles: map[accesscontrol.Role][]accesscontrol.Permission{
				{Name: "fixed:dashboards:writer"}: {
					{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsDelete, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsPermissionsRead, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsPermissionsWrite, Scope: dashboards.ScopeDashboardsAll},
				},
			},
			folders:        []*dashboards.Dashboard{basicFolder},
			folderPerms:    map[string][]accesscontrol.SetResourcePermissionCommand{basicFolder.UID: defaultPerms},
			dashboards:     []*dashboards.Dashboard{basicDashboard},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{basicDashboard.UID: defaultPerms},
			alerts:         []*models.Alert{basicAlert1},
			expected: []expectedAlertMigration{ // Expect no new folder.
				{
					Alert:  genAlert(basicAlert1.Name, basicFolder.UID, basicDashboard.UID),
					Folder: basicFolder,
					Perms:  defaultPerms,
				},
			},
		},
		{
			name:       "should ignore custom roles even if they would affect access",
			enterprise: true,
			roles: map[accesscontrol.Role][]accesscontrol.Permission{
				{Name: "custom role"}: {
					{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsWrite, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsDelete, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsCreate, Scope: dashboards.ScopeFoldersAll},
					{Action: dashboards.ActionDashboardsPermissionsRead, Scope: dashboards.ScopeDashboardsAll},
					{Action: dashboards.ActionDashboardsPermissionsWrite, Scope: dashboards.ScopeDashboardsAll},
				},
			},
			folders:        []*dashboards.Dashboard{basicFolder},
			folderPerms:    map[string][]accesscontrol.SetResourcePermissionCommand{basicFolder.UID: defaultPerms},
			dashboards:     []*dashboards.Dashboard{basicDashboard},
			dashboardPerms: map[string][]accesscontrol.SetResourcePermissionCommand{basicDashboard.UID: defaultPerms},
			alerts:         []*models.Alert{basicAlert1},
			expected: []expectedAlertMigration{ // Expect no new folder.
				{
					Alert:  genAlert(basicAlert1.Name, basicFolder.UID, basicDashboard.UID),
					Folder: basicFolder,
					Perms:  defaultPerms,
				},
			},
		},
	}
	for _, ttRaw := range tc {
		t.Run(ttRaw.name, func(t *testing.T) {
			for _, tt := range splitTestcase(ttRaw) {
				t.Run(tt.name, func(t *testing.T) {
					sqlStore := db.InitTestDB(t)
					x := sqlStore.GetEngine()

					if tt.enterprise {
						createRoles(t, context.Background(), sqlStore, tt.roles)
					}

					service := NewTestMigrationService(t, sqlStore, &setting.Cfg{})
					setupLegacyAlertsTables(t, x, nil, tt.alerts, tt.folders, tt.dashboards)

					for i := 1; i < 3; i++ {
						_, err := x.Insert(user.User{
							ID:      int64(i),
							UID:     fmt.Sprintf("u%d", i),
							OrgID:   1,
							Name:    fmt.Sprintf("user%v", i),
							Login:   fmt.Sprintf("user%v", i),
							Email:   fmt.Sprintf("user%v@example.org", i),
							Created: now,
							Updated: now,
						})
						require.NoError(t, err)
					}

					for i := 1; i < 3; i++ {
						_, err := x.Insert(team.Team{
							ID:      int64(i),
							OrgID:   1,
							UID:     fmt.Sprintf("team%v", i),
							Name:    fmt.Sprintf("team%v", i),
							Created: now,
							Updated: now,
						})
						require.NoError(t, err)
					}

					for _, f := range tt.folders {
						_, err := service.migrationStore.SetFolderPermissions(context.Background(), 1, f.UID, tt.folderPerms[f.UID]...)
						require.NoError(t, err)
					}
					for _, d := range tt.dashboards {
						_, err := service.migrationStore.SetDashboardPermissions(context.Background(), 1, d.UID, tt.dashboardPerms[d.UID]...)
						require.NoError(t, err)
					}

					err := service.Run(context.Background())
					require.NoError(t, err)

					// construct actuals.
					orgId := int64(1)
					rules := getAlertRules(t, x, orgId)
					actual := make([]expectedAlertMigration, 0, len(rules))
					for i, r := range rules {
						// Remove generated fields.
						require.NotEqual(t, r.Annotations[ngModels.MigratedAlertIdAnnotation], "")
						delete(r.Annotations, ngModels.MigratedAlertIdAnnotation)

						folder := getDashboard(t, x, orgId, r.NamespaceUID)
						rperms, err := service.migrationStore.GetFolderPermissions(context.Background(), getMigrationUser(orgId), folder.UID)
						require.NoError(t, err)

						expected := tt.expected[i]
						if expected.Folder.UID == "" {
							// We're expecting the UID to be generated, so remove it from comparison.
							folder.UID = ""
							r.NamespaceUID = ""
							expected.Alert.NamespaceUID = ""
						}

						keep := make(map[accesscontrol.SetResourcePermissionCommand]dashboardaccess.PermissionType)
						for _, p := range rperms {
							if permission := service.migrationStore.MapActions(p); permission != "" {
								sp := accesscontrol.SetResourcePermissionCommand{
									UserID:      p.UserId,
									TeamID:      p.TeamId,
									BuiltinRole: p.BuiltInRole,
								}
								pType := permissionMap[permission]
								current, ok := keep[sp]
								if !ok || pType > current {
									keep[sp] = pType
								}
							}
						}
						perms := make([]accesscontrol.SetResourcePermissionCommand, 0, len(keep))
						for p, pType := range keep {
							p.Permission = pType.String()
							perms = append(perms, p)
						}

						actual = append(actual, expectedAlertMigration{
							Alert:  r,
							Folder: folder,
							Perms:  perms,
						})
					}

					cOpt := []cmp.Option{
						cmpopts.SortSlices(func(a, b expectedAlertMigration) bool {
							return a.Alert.Title < b.Alert.Title
						}),
						cmpopts.SortSlices(func(a, b accesscontrol.SetResourcePermissionCommand) bool {
							if a.BuiltinRole != b.BuiltinRole {
								return a.BuiltinRole < b.BuiltinRole
							}
							if a.UserID != b.UserID {
								return a.UserID < b.UserID
							}
							if a.TeamID != b.TeamID {
								return a.TeamID < b.TeamID
							}
							return a.Permission < b.Permission
						}),
						cmpopts.IgnoreUnexported(ngModels.AlertRule{}, ngModels.AlertQuery{}),
						cmpopts.IgnoreFields(ngModels.AlertRule{}, "ID", "Updated", "UID", "ExecErrState"), // LOGZ.IO GRAFANA CHANGE :: DEV-46410 - Change default ExecErrState to OK and enforce OK value
						cmpopts.IgnoreFields(dashboards.Dashboard{}, "ID", "Created", "Updated", "Data", "Slug"),
					}
					if !cmp.Equal(tt.expected, actual, cOpt...) {
						t.Errorf("Unexpected Rule: %v", cmp.Diff(tt.expected, actual, cOpt...))
					}
				})
			}
		})
	}
}

func createRoles(t testing.TB, ctx context.Context, store db.DB, rolePerms map[accesscontrol.Role][]accesscontrol.Permission) {
	_ = store.WithDbSession(ctx, func(sess *db.Session) error {
		ts := time.Now()
		var roles []accesscontrol.Role

		basic := accesscontrol.BuildBasicRoleDefinitions()

		var permissions []accesscontrol.Permission
		var builtinRoleAssignments []accesscontrol.BuiltinRole
		var userRoleAssignments []accesscontrol.UserRole
		var teamRoleAssignments []accesscontrol.TeamRole
		i := int64(1)
		for role, perms := range rolePerms {
			if role.IsBasic() {
				for roleType, br := range basic {
					if br.Name == role.Name {
						role = br.Role()
						builtinRoleAssignments = append(builtinRoleAssignments, accesscontrol.BuiltinRole{
							OrgID: accesscontrol.GlobalOrgID, RoleID: i, Role: roleType, Created: ts, Updated: ts,
						})
					}
				}
			} else {
				userRoleAssignments = append(userRoleAssignments, accesscontrol.UserRole{
					OrgID: accesscontrol.GlobalOrgID, RoleID: i, UserID: 1, Created: ts,
				})
				teamRoleAssignments = append(teamRoleAssignments, accesscontrol.TeamRole{
					OrgID: accesscontrol.GlobalOrgID, RoleID: i, TeamID: 1, Created: ts,
				})
			}
			role.ID = i
			role.Created = ts
			role.Updated = ts

			roles = append(roles, role)

			for _, p := range perms {
				permissions = append(permissions, accesscontrol.Permission{
					RoleID: role.ID, Action: p.Action, Scope: p.Scope, Created: ts, Updated: ts,
				})
			}
			i++
		}

		_, err := sess.InsertMulti(&roles)
		require.NoError(t, err)

		_, err = sess.InsertMulti(&permissions)
		require.NoError(t, err)

		_, err = sess.InsertMulti(&builtinRoleAssignments)
		require.NoError(t, err)

		_, err = sess.InsertMulti(&userRoleAssignments)
		require.NoError(t, err)

		_, err = sess.InsertMulti(&teamRoleAssignments)
		require.NoError(t, err)

		return nil
	})
}
