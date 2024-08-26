package guardian

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	orgID            = 1
	dashUID          = "1"
	folderID         = 42
	folderUID        = "42"
	invalidFolderUID = "142"
)

var (
	folderUIDScope        = fmt.Sprintf("folders:uid:%s", folderUID)
	invalidFolderUIDScope = fmt.Sprintf("folders:uid:%s", invalidFolderUID)
	dashboard             = &dashboards.Dashboard{OrgID: orgID, UID: dashUID, IsFolder: false, FolderUID: folderUID}
	fldr                  = &dashboards.Dashboard{OrgID: orgID, UID: folderUID, IsFolder: true}
)

type accessControlGuardianTestCase struct {
	desc           string
	dashboard      *dashboards.Dashboard
	permissions    []accesscontrol.Permission
	viewersCanEdit bool
	expected       bool
}

func TestAccessControlDashboardGuardian_CanSave(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:      "should be able to save dashboard with dashboard wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to save dashboard with folder wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to save dashboard with dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to save dashboard under root with general folder scope",
			dashboard: &dashboards.Dashboard{OrgID: orgID, UID: dashUID, IsFolder: false},
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "folders:uid:general",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to save dashboard with incorrect dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to save dashboard with incorrect folder scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to save folder with folder write and dashboard wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to save folder with folder write and folder wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to save folder with folder write and dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to save folder with folder write and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  folderUIDScope,
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to save folder with folder write and incorrect dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to save folder with folder write and incorrect folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  invalidFolderUID,
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboard, tt.permissions, nil)
			can, err := guardian.CanSave()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanEdit(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:      "should be able to edit dashboard with dashboard wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to edit dashboard with folder wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to edit dashboard with dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to edit dashboard under root with general folder scope",
			dashboard: &dashboards.Dashboard{OrgID: orgID, UID: dashUID, IsFolder: false},
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "folders:uid:general",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to edit dashboard with incorrect dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to edit dashboard with incorrect folder scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsWrite,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to edit dashboard with read action when viewer_can_edit is true",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  "dashboards:uid:1",
				},
			},
			viewersCanEdit: true,
			expected:       true,
		},
		{
			desc:      "should not be able to edit folder with folder write and dashboard wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to edit folder with folder write and folder wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to edit folder with folder write and dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to edit folder with folder write and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  folderUIDScope,
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to edit folder with folder write and incorrect folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to edit folder with folder read action when viewer_can_edit is true",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  folderUIDScope,
				},
			},
			viewersCanEdit: true,
			expected:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.ViewersCanEdit = tt.viewersCanEdit
			guardian := setupAccessControlGuardianTest(t, tt.dashboard, tt.permissions, cfg)

			can, err := guardian.CanEdit()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanView(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:      "should be able to view dashboard with dashboard wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to view dashboard with folder wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to view dashboard with dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to view dashboard under root with general folder scope",
			dashboard: &dashboards.Dashboard{OrgID: orgID, UID: dashUID, IsFolder: false},
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  "folders:uid:general",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to view dashboard with incorrect dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to view dashboard with incorrect folder scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsRead,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to view folder with folders read and dashboard wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  "dashboards:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to view folder with folders read and folder wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to folder view with folders read and dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to view folder with folders read and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  folderUIDScope,
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to view folder with folders read incorrect dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to view folder with folders read and incorrect folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersRead,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboard, tt.permissions, nil)

			can, err := guardian.CanView()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanAdmin(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:      "should be able to admin dashboard with dashboard wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsPermissionsRead,
					Scope:  "dashboards:*",
				},
				{
					Action: dashboards.ActionDashboardsPermissionsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to admin dashboard with folder wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsPermissionsRead,
					Scope:  "folders:*",
				},
				{
					Action: dashboards.ActionDashboardsPermissionsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to admin dashboard with dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsPermissionsRead,
					Scope:  "dashboards:uid:1",
				},
				{
					Action: dashboards.ActionDashboardsPermissionsWrite,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to admin dashboard under root with general folder scope",
			dashboard: &dashboards.Dashboard{OrgID: orgID, UID: dashUID, IsFolder: false},
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsPermissionsRead,
					Scope:  "folders:uid:general",
				},
				{
					Action: dashboards.ActionDashboardsPermissionsWrite,
					Scope:  "folders:uid:general",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to admin dashboard with incorrect dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsPermissionsRead,
					Scope:  "dashboards:uid:10",
				},
				{
					Action: dashboards.ActionDashboardsPermissionsWrite,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin dashboard with incorrect folder scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsPermissionsRead,
					Scope:  invalidFolderUIDScope,
				},
				{
					Action: dashboards.ActionDashboardsPermissionsWrite,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin folder with folder read and write and dashboard wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  "dashboards:*",
				},
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  "dashboards:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to admin folder with folder read and write and wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  "folders:*",
				},
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to admin folder with folder read and wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  "folders:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin folder with folder write and wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  "folders:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin folder with folder read and write and dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  "dashboards:uid:1",
				},
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to admin folder with folder read and write and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  folderUIDScope,
				},
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  folderUIDScope,
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to admin folder with folder read and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  folderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin folder with folder write and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  folderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin folder with folder read and write and incorrect dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  "dashboards:uid:10",
				},
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to admin folder with folder read and write and incorrect folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersPermissionsRead,
					Scope:  invalidFolderUIDScope,
				},
				{
					Action: dashboards.ActionFoldersPermissionsWrite,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboard, tt.permissions, nil)

			can, err := guardian.CanAdmin()
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func TestAccessControlDashboardGuardian_CanDelete(t *testing.T) {
	tests := []accessControlGuardianTestCase{
		{
			desc:      "should be able to delete dashboard with dashboard wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsDelete,
					Scope:  "dashboards:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to delete dashboard with folder wildcard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsDelete,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to delete dashboard with dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsDelete,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: true,
		},
		{
			desc:      "should be able to delete dashboard under root with general folder scope",
			dashboard: &dashboards.Dashboard{OrgID: orgID, UID: dashUID, IsFolder: false},
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsDelete,
					Scope:  "folders:uid:general",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to delete dashboard with incorrect dashboard scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsDelete,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to delete dashboard with incorrect folder scope",
			dashboard: dashboard,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionDashboardsDelete,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to delete folder with folder delete and dashboard wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersDelete,
					Scope:  "dashboards:*",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to delete folder with folder deletea and folder wildcard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersDelete,
					Scope:  "folders:*",
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to delete folder with folder delete and dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersDelete,
					Scope:  "dashboards:uid:1",
				},
			},
			expected: false,
		},
		{
			desc:      "should be able to delete folder with folder delete and folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersDelete,
					Scope:  folderUIDScope,
				},
			},
			expected: true,
		},
		{
			desc:      "should not be able to delete folder with folder delete and incorrect dashboard scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersDelete,
					Scope:  "dashboards:uid:10",
				},
			},
			expected: false,
		},
		{
			desc:      "should not be able to delete folder with folder delete and incorrect folder scope",
			dashboard: fldr,
			permissions: []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersDelete,
					Scope:  invalidFolderUIDScope,
				},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, tt.dashboard, tt.permissions, nil)

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
	permissions []accesscontrol.Permission
	expected    bool
}

func TestAccessControlDashboardGuardian_CanCreate(t *testing.T) {
	tests := []accessControlGuardianCanCreateTestCase{
		{
			desc:     "should be able to create dashboard in general folder",
			isFolder: false,
			folderID: 0,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:general"},
			},
			expected: true,
		},
		{
			desc:     "should be able to create dashboard in any folder",
			isFolder: false,
			folderID: 0,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:*"},
			},
			expected: true,
		},
		{
			desc:        "should not be able to create dashboard without permissions",
			isFolder:    false,
			folderID:    0,
			permissions: []accesscontrol.Permission{},
			expected:    false,
		},
		{
			desc:     "should be able to create folder with correct permissions",
			isFolder: true,
			folderID: 0,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersCreate},
			},
			expected: true,
		},
		{
			desc:        "should not be able to create folders without permissions",
			isFolder:    true,
			folderID:    0,
			permissions: []accesscontrol.Permission{},
			expected:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			guardian := setupAccessControlGuardianTest(t, &dashboards.Dashboard{OrgID: orgID, UID: "0", IsFolder: tt.isFolder}, tt.permissions, nil)

			can, err := guardian.CanCreate(tt.folderID, tt.isFolder)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, can)
		})
	}
}

func setupAccessControlGuardianTest(
	t *testing.T, d *dashboards.Dashboard,
	permissions []accesscontrol.Permission, cfg *setting.Cfg,
) DashboardGuardian {
	t.Helper()

	fakeDashboardService := dashboards.NewFakeDashboardService(t)
	fakeDashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Maybe().Return(d, nil)

	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())
	folderSvc := foldertest.NewFakeService()

	folderStore := foldertest.NewFakeFolderStore(t)

	ac.RegisterScopeAttributeResolver(dashboards.NewDashboardUIDScopeResolver(folderStore, fakeDashboardService, folderSvc))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderUIDScopeResolver(folderSvc))
	ac.RegisterScopeAttributeResolver(dashboards.NewFolderIDScopeResolver(folderStore, folderSvc))

	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", "accesscontrol.enforcement").Return(true).Maybe()

	userPermissions := map[int64]map[string][]string{}
	for _, p := range permissions {
		if _, ok := userPermissions[orgID]; !ok {
			userPermissions[orgID] = map[string][]string{}
		}
		userPermissions[orgID][p.Action] = append(userPermissions[orgID][p.Action], p.Scope)
	}

	g, err := NewAccessControlDashboardGuardianByDashboard(context.Background(), cfg, d, &user.SignedInUser{OrgID: orgID, Permissions: userPermissions}, ac, fakeDashboardService)
	require.NoError(t, err)
	return g
}
