package permissions_test

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegration_DashboardFilter_Split_Scope(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		desc           string
		queryType      string
		permission     dashboards.PermissionType
		permissions    []accesscontrol.Permission
		expectedResult int
	}

	tests := []testCase{
		{
			desc:       "Should be able to view all dashboards with wildcard scope",
			permission: dashboards.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
			},
			expectedResult: 100,
		},
		{
			desc:       "Should be able to view all dashboards with folder wildcard scope",
			permission: dashboards.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			expectedResult: 100,
		},
		{
			desc:       "Should be able to view a subset of dashboards with dashboard scopes",
			permission: dashboards.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:110"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:40"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:22"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:13"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:55"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:99"},
			},
			expectedResult: 6,
		},
		{
			desc:       "Should be able to view a subset of dashboards with dashboard action and folder scope",
			permission: dashboards.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:8"},
				{Action: dashboards.ActionDashboardsRead, Scope: "folders:uid:10"},
			},
			expectedResult: 20,
		},
		{
			desc:       "Should be able to view all folders with folder wildcard",
			permission: dashboards.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:*"},
			},
			expectedResult: 10,
		},
		{
			desc:       "Should be able to view a subset folders",
			permission: dashboards.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:6"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:9"},
			},
			expectedResult: 3,
		},
		{
			desc:       "Should return folders and dashboard with 'edit' permission",
			permission: dashboards.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:3"},
				{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:33"},
			},
			expectedResult: 2,
		},
		{
			desc:       "Should return the dashboards that the User has dashboards:write permission on in case of 'edit' permission",
			permission: dashboards.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:31"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:32"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33"},
				{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:33"},
			},
			expectedResult: 1,
		},
		{
			desc:       "Should return the folders that the User has dashboards:create permission on in case of 'edit' permission",
			permission: dashboards.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:4"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:32"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33"},
			},
			expectedResult: 1,
		},
		{
			desc:       "Should return folders that users can read alerts from",
			permission: dashboards.PERMISSION_VIEW,
			queryType:  searchstore.TypeAlertFolder,
			permissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:3"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:8"},
			},
			expectedResult: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			store := setupTest(t, 10, 100, tt.permissions)

			usr := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}}
			filter := permissions.NewDashboardFilter(usr, tt.permission, tt.queryType, featuremgmt.WithFeatures(), false)

			count, err := queryWithFilter(store, filter)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedResult, count)

			// test with self-contained permissions
			usr = &user.SignedInUser{OrgID: 1, AuthenticatedBy: login.ExtendedJWTModule, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(tt.permissions)}}
			filter = permissions.NewDashboardFilter(usr, tt.permission, tt.queryType, featuremgmt.WithFeatures(), false)

			count, err = queryWithFilter(store, filter)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedResult, count)
		})
	}
}

func queryWithFilter(store db.DB, filter *permissions.DashboardFilter) (int, error) {
	var result int
	err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		query := strings.Builder{}
		params := []interface{}{}

		query.WriteString("SELECT COUNT(*) FROM dashboard ")
		join := filter.LeftJoin()
		if join != "" {
			query.WriteString(" LEFT OUTER JOIN ")
			query.WriteString(join)
		}

		query.WriteString(" WHERE ")
		where, whereParams := filter.Where()
		query.WriteString(where)
		params = append(params, whereParams...)
		_, err := sess.SQL(query.String(), params...).Get(&result)
		return err
	})
	return result, err
}
