package permissions

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

func TestNewAccessControlDashboardPermissionFilter(t *testing.T) {
	randomType := "random_" + util.GenerateShortUID()
	testCases := []struct {
		permission               models.PermissionType
		queryType                string
		expectedDashboardActions []string
		expectedFolderActions    []string
	}{
		{
			queryType:                searchstore.TypeAlertFolder,
			permission:               models.PERMISSION_ADMIN,
			expectedDashboardActions: nil,
			expectedFolderActions: []string{
				dashboards.ActionFoldersRead,
				accesscontrol.ActionAlertingRuleRead,
				accesscontrol.ActionAlertingRuleCreate,
			},
		},
		{
			queryType:                searchstore.TypeAlertFolder,
			permission:               models.PERMISSION_EDIT,
			expectedDashboardActions: nil,
			expectedFolderActions: []string{
				dashboards.ActionFoldersRead,
				accesscontrol.ActionAlertingRuleRead,
				accesscontrol.ActionAlertingRuleCreate,
			},
		},
		{
			queryType:                searchstore.TypeAlertFolder,
			permission:               models.PERMISSION_VIEW,
			expectedDashboardActions: nil,
			expectedFolderActions: []string{
				dashboards.ActionFoldersRead,
				accesscontrol.ActionAlertingRuleRead,
			},
		},
		{
			queryType:  randomType,
			permission: models.PERMISSION_ADMIN,
			expectedDashboardActions: []string{
				dashboards.ActionDashboardsRead,
				dashboards.ActionDashboardsWrite,
			},
			expectedFolderActions: []string{
				dashboards.ActionFoldersRead,
				dashboards.ActionDashboardsCreate,
			},
		},
		{
			queryType:  randomType,
			permission: models.PERMISSION_EDIT,
			expectedDashboardActions: []string{
				dashboards.ActionDashboardsRead,
				dashboards.ActionDashboardsWrite,
			},
			expectedFolderActions: []string{
				dashboards.ActionFoldersRead,
				dashboards.ActionDashboardsCreate,
			},
		},
		{
			queryType:  randomType,
			permission: models.PERMISSION_VIEW,
			expectedDashboardActions: []string{
				dashboards.ActionDashboardsRead,
			},
			expectedFolderActions: []string{
				dashboards.ActionFoldersRead,
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(fmt.Sprintf("query type %s, permissions %s", testCase.queryType, testCase.permission), func(t *testing.T) {
			filters := NewAccessControlDashboardPermissionFilter(&user.SignedInUser{}, testCase.permission, testCase.queryType)

			require.Equal(t, testCase.expectedDashboardActions, filters.dashboardActions)
			require.Equal(t, testCase.expectedFolderActions, filters.folderActions)
		})
	}
}

func TestAccessControlDashboardPermissionFilter_Where(t *testing.T) {
	testCases := []struct {
		title            string
		dashboardActions []string
		folderActions    []string
		expectedResult   string
	}{
		{
			title:            "folder and dashboard actions are defined",
			dashboardActions: []string{"test"},
			folderActions:    []string{"test"},
			expectedResult:   "((( 1 = 0 OR dashboard.folder_id IN(SELECT id FROM dashboard WHERE  1 = 0)) AND NOT dashboard.is_folder) OR ( 1 = 0 AND dashboard.is_folder))",
		},
		{
			title:            "folder actions are defined but not dashboard actions",
			dashboardActions: nil,
			folderActions:    []string{"test"},
			expectedResult:   "(( 1 = 0 AND dashboard.is_folder))",
		},
		{
			title:            "dashboard actions are defined but not folder actions",
			dashboardActions: []string{"test"},
			folderActions:    nil,
			expectedResult:   "((( 1 = 0 OR dashboard.folder_id IN(SELECT id FROM dashboard WHERE  1 = 0)) AND NOT dashboard.is_folder))",
		},
		{
			title:            "dashboard actions are defined but not folder actions",
			dashboardActions: nil,
			folderActions:    nil,
			expectedResult:   "()",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.title, func(t *testing.T) {
			filter := AccessControlDashboardPermissionFilter{
				User:             &user.SignedInUser{Permissions: map[int64]map[string][]string{}},
				dashboardActions: testCase.dashboardActions,
				folderActions:    testCase.folderActions,
			}

			query, args := filter.Where()

			assert.Empty(t, args)
			assert.Equal(t, testCase.expectedResult, query)
		})
	}
}
