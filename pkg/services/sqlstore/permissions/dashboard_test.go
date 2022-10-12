package permissions

import (
	"fmt"
	"testing"

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
		permission              models.PermissionType
		queryType               string
		expectedDashboardAction string
		expectedFolderAction    string
	}{
		{
			queryType:               searchstore.TypeAlertFolder,
			permission:              models.PERMISSION_ADMIN,
			expectedDashboardAction: "",
			expectedFolderAction:    accesscontrol.ActionAlertingRuleCreate,
		},
		{
			queryType:               searchstore.TypeAlertFolder,
			permission:              models.PERMISSION_EDIT,
			expectedDashboardAction: "",
			expectedFolderAction:    accesscontrol.ActionAlertingRuleCreate,
		},
		{
			queryType:               searchstore.TypeAlertFolder,
			permission:              models.PERMISSION_VIEW,
			expectedDashboardAction: "",
			expectedFolderAction:    accesscontrol.ActionAlertingRuleRead,
		},
		{
			queryType:               randomType,
			permission:              models.PERMISSION_ADMIN,
			expectedDashboardAction: dashboards.ActionDashboardsWrite,
			expectedFolderAction:    dashboards.ActionFoldersWrite,
		},
		{
			queryType:               randomType,
			permission:              models.PERMISSION_EDIT,
			expectedDashboardAction: dashboards.ActionDashboardsWrite,
			expectedFolderAction:    dashboards.ActionFoldersWrite,
		},
		{
			queryType:               randomType,
			permission:              models.PERMISSION_VIEW,
			expectedDashboardAction: dashboards.ActionDashboardsRead,
			expectedFolderAction:    dashboards.ActionFoldersRead,
		},
	}

	for _, testCase := range testCases {
		t.Run(fmt.Sprintf("query type %s, permissions %s", testCase.queryType, testCase.permission), func(t *testing.T) {
			filters := NewAccessControlDashboardPermissionFilter(&user.SignedInUser{}, testCase.permission, testCase.queryType)

			require.Equal(t, testCase.expectedDashboardAction, filters.dashboardAction)
			require.Equal(t, testCase.expectedFolderAction, filters.folderAction)
		})
	}
}
