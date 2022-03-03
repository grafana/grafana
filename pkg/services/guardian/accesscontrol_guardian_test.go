package guardian

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	dashdb "github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type accessControlGuardianTestCase struct {
	desc           string
	dashboardID    int64
	permissions    []*accesscontrol.Permission
	viewersCanEdit bool
	expected       bool
}

func TestAccessControlDashboardGuardian_CanSave(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:        "should be able to save with dashboard wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to save with folder wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to save with dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "dashboards:id:1",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to save with folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "folders:id:0",
				},
			},
			expected: true,
		},
		{
			desc:        "should not be able to save with incorrect dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "dashboards:id:10",
				},
			},
			expected: false,
		},
		{
			desc:        "should not be able to save with incorrect folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "folders:id:10",
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboardID, tt.permissions)

			can, err := guardian.CanSave()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanEdit(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:        "should be able to edit with dashboard wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to edit with folder wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to edit with dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "dashboards:id:1",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to edit with folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "folders:id:0",
				},
			},
			expected: true,
		},
		{
			desc:        "should not be able to edit with incorrect dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "dashboards:id:10",
				},
			},
			expected: false,
		},
		{
			desc:        "should not be able to edit with incorrect folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsWrite,
					Scope:  "folders:id:10",
				},
			},
			expected: false,
		},
		{
			desc:        "should be able to edit with read action when viewer_can_edit is true",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "dashboards:id:1",
				},
			},
			viewersCanEdit: true,
			expected:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboardID, tt.permissions)

			if tt.viewersCanEdit {
				setting.ViewersCanEdit = true
				defer func() { setting.ViewersCanEdit = false }()
			}

			can, err := guardian.CanEdit()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanView(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:        "should be able to view with dashboard wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to view with folder wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to view with dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "dashboards:id:1",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to view with folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "folders:id:0",
				},
			},
			expected: true,
		},
		{
			desc:        "should not be able to view with incorrect dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "dashboards:id:10",
				},
			},
			expected: false,
		},
		{
			desc:        "should not be able to view with incorrect folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsRead,
					Scope:  "folders:id:10",
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboardID, tt.permissions)

			can, err := guardian.CanView()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanAdmin(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:        "should be able to admin with dashboard wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsPermissionsRead,
					Scope:  "dashboards:*",
				},
				{
					Action: accesscontrol.ActionDashboardsPermissionsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to admin with folder wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsPermissionsRead,
					Scope:  "folders:*",
				},
				{
					Action: accesscontrol.ActionDashboardsPermissionsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to admin with dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsPermissionsRead,
					Scope:  "dashboards:id:1",
				},
				{
					Action: accesscontrol.ActionDashboardsPermissionsWrite,
					Scope:  "dashboards:id:1",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to admin with folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsPermissionsRead,
					Scope:  "folders:id:0",
				},
				{
					Action: accesscontrol.ActionDashboardsPermissionsWrite,
					Scope:  "folders:id:0",
				},
			},
			expected: true,
		},
		{
			desc:        "should not be able to admin with incorrect dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsPermissionsRead,
					Scope:  "dashboards:id:10",
				},
				{
					Action: accesscontrol.ActionDashboardsPermissionsWrite,
					Scope:  "dashboards:id:10",
				},
			},
			expected: false,
		},
		{
			desc:        "should not be able to admin with incorrect folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsPermissionsRead,
					Scope:  "folders:id:10",
				},
				{
					Action: accesscontrol.ActionDashboardsPermissionsWrite,
					Scope:  "folders:id:10",
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboardID, tt.permissions)

			can, err := guardian.CanAdmin()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanDelete(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:        "should be able to delete with dashboard wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsDelete,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to delete with folder wildcard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsDelete,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to delete with dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsDelete,
					Scope:  "dashboards:id:1",
				},
			},
			expected: true,
		},
		{
			desc:        "should be able to delete with folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsDelete,
					Scope:  "folders:id:0",
				},
			},
			expected: true,
		},
		{
			desc:        "should not be able to delete with incorrect dashboard scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsDelete,
					Scope:  "dashboards:id:10",
				},
			},
			expected: false,
		},
		{
			desc:        "should not be able to delete with incorrect folder scope",
			dashboardID: 1,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionDashboardsDelete,
					Scope:  "folders:id:10",
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboardID, tt.permissions)

			can, err := guardian.CanDelete()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

type accessControlGuardianCanCreateTestCase struct {
	desc        string
	isFolder    bool
	folderID    int64
	permissions []*accesscontrol.Permission
	expected    bool
}

func TestAccessControlDashboardGuardian_CanCreate(t *testing.T) {
	tests := []accessControlGuardianCanCreateTestCase{
		{
			desc:     "should be able to create dashboard in folder 0",
			isFolder: false,
			folderID: 0,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionDashboardsCreate, Scope: "folders:id:0"},
			},
			expected: true,
		},
		{
			desc:     "should be able to create dashboard in any folder",
			isFolder: false,
			folderID: 100,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionDashboardsCreate, Scope: "folders:*"},
			},
			expected: true,
		},
		{
			desc:        "should not be able to create dashboard without permissions",
			isFolder:    false,
			folderID:    100,
			permissions: []*accesscontrol.Permission{},
			expected:    false,
		},
		{
			desc:     "should be able to create folder with correct permissions",
			isFolder: true,
			folderID: 0,
			permissions: []*accesscontrol.Permission{
				{Action: accesscontrol.ActionFoldersCreate},
			},
			expected: true,
		},
		{
			desc:        "should not be able to create folders without permissions",
			isFolder:    true,
			folderID:    100,
			permissions: []*accesscontrol.Permission{},
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, 0, tt.permissions)

			can, err := guardian.CanCreate(tt.folderID, tt.isFolder)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func setupAccessControlGuardianTest(t *testing.T, dashID int64, permissions []*accesscontrol.Permission) *AccessControlDashboardGuardian {
	t.Helper()
	store := sqlstore.InitTestDB(t)
	// seed dashboard
	_, err := dashdb.ProvideDashboardStore(store).SaveDashboard(models.SaveDashboardCommand{
		Dashboard: &simplejson.Json{},
		UserId:    1,
		OrgId:     1,
		FolderId:  0,
	})
	require.NoError(t, err)

	ac := accesscontrolmock.New().WithPermissions(permissions)
	services, err := ossaccesscontrol.ProvidePermissionsServices(routing.NewRouteRegister(), store, ac, database.ProvideService(store))
	require.NoError(t, err)

	return NewAccessControlDashboardGuardian(context.Background(), dashID, &models.SignedInUser{OrgId: 1}, store, ac, services)
}
