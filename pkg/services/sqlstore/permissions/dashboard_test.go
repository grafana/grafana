package permissions_test

import (
	"context"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol/testutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/permissions"
	"github.com/grafana/grafana/pkg/services/sqlstore/searchstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegration_DashboardPermissionFilter(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		desc           string
		queryType      string
		permission     dashboardaccess.PermissionType
		permissions    []accesscontrol.Permission
		expectedResult int
	}

	tests := []testCase{
		{
			desc:       "Should be able to view all dashboards with wildcard scope",
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
			},
			expectedResult: 110,
		},
		{
			desc:       "Should be able to view all dashboards with folder wildcard scope",
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			expectedResult: 110,
		},
		{
			desc:       "Should not be able to view editable dashboards under the root with folders:uid:general scope if missing write action",
			permission: dashboardaccess.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)},
			},
			expectedResult: 0,
		},
		{
			desc:       "Should be able to view a subset of dashboards with dashboard scopes",
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:110", Kind: "dashboards", Identifier: "110"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:40", Kind: "dashboards", Identifier: "40"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:22", Kind: "dashboards", Identifier: "22"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:13", Kind: "dashboards", Identifier: "13"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:55", Kind: "dashboards", Identifier: "55"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:99", Kind: "dashboards", Identifier: "99"},
			},
			expectedResult: 6,
		},
		{
			desc:       "Should be able to view all folders with folder wildcard",
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:*"},
			},
			expectedResult: 10,
		},
		{
			desc:       "Should be able to view a subset folders",
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:6", Kind: "folders", Identifier: "6"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:9", Kind: "folders", Identifier: "9"},
			},
			expectedResult: 3,
		},
		{
			desc:       "Should return folders and dashboard with 'edit' permission",
			permission: dashboardaccess.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33", Kind: "dashboards", Identifier: "33"},
				{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:33", Kind: "dashboards", Identifier: "33"},
			},
			expectedResult: 2,
		},
		{
			desc:       "Should return the dashboards that the User has dashboards:write permission on in case of 'edit' permission",
			permission: dashboardaccess.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:31", Kind: "dashboards", Identifier: "31"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:32", Kind: "dashboards", Identifier: "32"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33", Kind: "dashboards", Identifier: "33"},
				{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:33", Kind: "dashboards", Identifier: "33"},
			},
			expectedResult: 1,
		},
		{
			desc:       "Should return the folders that the User has dashboards:create permission on in case of 'edit' permission",
			permission: dashboardaccess.PERMISSION_EDIT,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:4", Kind: "folders", Identifier: "4"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:32", Kind: "dashboards", Identifier: "32"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33", Kind: "dashboards", Identifier: "33"},
			},
			expectedResult: 1,
		},
		{
			desc:       "Should return folders that users can read alerts from",
			permission: dashboardaccess.PERMISSION_VIEW,
			queryType:  searchstore.TypeAlertFolder,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:8", Kind: "folders", Identifier: "8"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:8", Kind: "folders", Identifier: "8"},
			},
			expectedResult: 2,
		},
		{
			desc:       "Should return folders that users can read alerts when user has read wildcard",
			permission: dashboardaccess.PERMISSION_VIEW,
			queryType:  searchstore.TypeAlertFolder,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "*"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:3", Kind: "folders", Identifier: "3"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:8", Kind: "folders", Identifier: "8"},
			},
			expectedResult: 2,
		},
	}

	for _, tt := range tests {
		store := setupTest(t, 10, 110, tt.permissions)
		recursiveQueriesAreSupported, err := store.RecursiveQueriesAreSupported()
		require.NoError(t, err)

		usr := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.permissions)}}

		for _, features := range []featuremgmt.FeatureToggles{featuremgmt.WithFeatures(), featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery)} {
			m := features.GetEnabled(context.Background())
			keys := make([]string, 0, len(m))
			for k := range m {
				keys = append(keys, k)
			}
			t.Run(tt.desc+" with features "+strings.Join(keys, ","), func(t *testing.T) {
				filter := permissions.NewAccessControlDashboardPermissionFilter(usr, tt.permission, tt.queryType, features, recursiveQueriesAreSupported)

				var result int
				err = store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					q, params := filter.Where()
					recQry, recQryParams := filter.With()
					params = append(recQryParams, params...)
					leftJoin := filter.LeftJoin()
					s := recQry + "\nSELECT COUNT(*) FROM dashboard WHERE " + q
					if leftJoin != "" {
						s = recQry + "\nSELECT COUNT(*) FROM dashboard LEFT OUTER JOIN " + leftJoin + " WHERE " + q
					}
					_, err := sess.SQL(s, params...).Get(&result)
					return err
				})
				require.NoError(t, err)

				assert.Equal(t, tt.expectedResult, result)
			})
		}
	}
}

func TestIntegration_DashboardPermissionFilter_WithSelfContainedPermissions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	type testCase struct {
		desc                    string
		queryType               string
		permission              dashboardaccess.PermissionType
		signedInUserPermissions []accesscontrol.Permission
		expectedResult          int
	}

	tests := []testCase{
		{
			desc:       "Should be able to view all dashboards with wildcard scope",
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
			},
			expectedResult: 110,
		},
		{
			desc:       "Should be able to view all dashboards with folder wildcard scope",
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			expectedResult: 110,
		},
		{
			desc:                    "Should not be able to view any dashboards or folders without any permissions",
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{},
			expectedResult:          0,
		},
		{
			desc:       "Should be able to view a subset of dashboards with dashboard scopes",
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
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
			desc:       "Should not be able to view editable dashboards under the root with folders:uid:general scope if missing write action",
			permission: dashboardaccess.PERMISSION_EDIT,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)},
			},
			expectedResult: 0,
		},
		{
			desc:       "Should be able to view all folders with folder wildcard",
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:*"},
			},
			expectedResult: 10,
		},
		{
			desc:       "Should be able to view a subset folders",
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:6"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:9"},
			},
			expectedResult: 3,
		},
		{
			desc:       "Should return folders and dashboard with 'edit' permission",
			permission: dashboardaccess.PERMISSION_EDIT,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3"},
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:3"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33"},
				{Action: dashboards.ActionDashboardsWrite, Scope: "dashboards:uid:33"},
			},
			expectedResult: 2,
		},
		{
			desc:       "Should return the dashboards that the User has dashboards:write permission on in case of 'edit' permission",
			permission: dashboardaccess.PERMISSION_EDIT,
			signedInUserPermissions: []accesscontrol.Permission{
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
			permission: dashboardaccess.PERMISSION_EDIT,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3"},
				{Action: dashboards.ActionDashboardsCreate, Scope: "folders:uid:3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:4"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:32"},
				{Action: dashboards.ActionDashboardsRead, Scope: "dashboards:uid:33"},
			},
			expectedResult: 1,
		},
		{
			desc:       "Should return folders that users can read alerts from",
			permission: dashboardaccess.PERMISSION_VIEW,
			queryType:  searchstore.TypeAlertFolder,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:3"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:3"},
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:8"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:8"},
			},
			expectedResult: 2,
		},
		{
			desc:       "Should return folders that users can read alerts when user has read wildcard",
			permission: dashboardaccess.PERMISSION_VIEW,
			queryType:  searchstore.TypeAlertFolder,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "*"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:3"},
				{Action: accesscontrol.ActionAlertingRuleRead, Scope: "folders:uid:8"},
			},
			expectedResult: 2,
		},
	}

	for _, tt := range tests {
		store := setupTest(t, 10, 110, []accesscontrol.Permission{})
		recursiveQueriesAreSupported, err := store.RecursiveQueriesAreSupported()
		require.NoError(t, err)

		usr := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer, AuthenticatedBy: login.ExtendedJWTModule, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByActionContext(context.Background(), tt.signedInUserPermissions)}}

		for _, features := range []featuremgmt.FeatureToggles{featuremgmt.WithFeatures(), featuremgmt.WithFeatures(featuremgmt.FlagPermissionsFilterRemoveSubquery)} {
			m := features.GetEnabled(context.Background())
			keys := make([]string, 0, len(m))
			for k := range m {
				keys = append(keys, k)
			}
			t.Run(tt.desc+" with features "+strings.Join(keys, ","), func(t *testing.T) {
				filter := permissions.NewAccessControlDashboardPermissionFilter(usr, tt.permission, tt.queryType, features, recursiveQueriesAreSupported)

				var result int
				err = store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					q, params := filter.Where()
					recQry, recQryParams := filter.With()
					params = append(recQryParams, params...)
					s := recQry + "\nSELECT COUNT(*) FROM dashboard WHERE " + q
					leftJoin := filter.LeftJoin()
					if leftJoin != "" {
						s = recQry + "\nSELECT COUNT(*) FROM dashboard LEFT OUTER JOIN " + leftJoin + " WHERE " + q
					}
					_, err := sess.SQL(s, params...).Get(&result)
					return err
				})
				require.NoError(t, err)

				assert.Equal(t, tt.expectedResult, result)
			})
		}
	}
}

func TestIntegration_DashboardNestedPermissionFilter(t *testing.T) {
	testCases := []struct {
		desc           string
		queryType      string
		permission     dashboardaccess.PermissionType
		permissions    []accesscontrol.Permission
		expectedResult []string
		features       []any
	}{
		{
			desc:           "Should not be able to view dashboards under inherited folders with no permissions if nested folders are enabled",
			queryType:      searchstore.TypeDashboard,
			permission:     dashboardaccess.PERMISSION_VIEW,
			permissions:    nil,
			features:       []any{featuremgmt.FlagNestedFolders},
			expectedResult: nil,
		},
		{
			desc:           "Should not be able to view inherited folders with no permissions if nested folders are enabled",
			queryType:      searchstore.TypeFolder,
			permission:     dashboardaccess.PERMISSION_VIEW,
			permissions:    nil,
			features:       []any{featuremgmt.FlagNestedFolders},
			expectedResult: nil,
		},
		{
			desc:           "Should not be able to view inherited dashboards and folders with no permissions if nested folders are enabled",
			permission:     dashboardaccess.PERMISSION_VIEW,
			permissions:    nil,
			features:       []any{featuremgmt.FlagNestedFolders},
			expectedResult: nil,
		},
		{
			desc:       "Should be able to view dashboards under inherited folders with wildcard scope if nested folders are enabled",
			queryType:  searchstore.TypeDashboard,
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			features:       []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"dashboard under the root", "dashboard under parent folder", "dashboard under subfolder"},
		},
		{
			desc:       "Should be able to view inherited folders if nested folders are enabled",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:parent", Kind: "folders", Identifier: "parent"},
			},
			features:       []any{featuremgmt.FlagNestedFolders},
			expectedResult: []string{"parent", "subfolder"},
		},
		{
			desc:       "Should not be able to view inherited folders if nested folders are not enabled",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:parent", Kind: "folders", Identifier: "parent"},
			},
			features:       []any{},
			expectedResult: []string{"parent"},
		},
	}

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	var orgID int64 = 1

	for _, tc := range testCases {
		tc.permissions = append(tc.permissions, accesscontrol.Permission{
			Action: dashboards.ActionFoldersCreate,
		}, accesscontrol.Permission{
			Action: dashboards.ActionFoldersWrite,
			Scope:  dashboards.ScopeFoldersAll,
		})
		usr := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), tc.permissions)}}

		for _, features := range []featuremgmt.FeatureToggles{featuremgmt.WithFeatures(append(tc.features, featuremgmt.FlagAccessActionSets)...), featuremgmt.WithFeatures(tc.features...), featuremgmt.WithFeatures(append(tc.features, featuremgmt.FlagPermissionsFilterRemoveSubquery)...)} {
			m := features.GetEnabled(context.Background())
			keys := make([]string, 0, len(m))
			for k := range m {
				keys = append(keys, k)
			}

			t.Run(tc.desc+" with features "+strings.Join(keys, ","), func(t *testing.T) {
				db := setupNestedTest(t, usr, tc.permissions, orgID, features)
				recursiveQueriesAreSupported, err := db.RecursiveQueriesAreSupported()
				require.NoError(t, err)
				filter := permissions.NewAccessControlDashboardPermissionFilter(usr, tc.permission, tc.queryType, features, recursiveQueriesAreSupported)
				var result []string
				err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					q, params := filter.Where()
					recQry, recQryParams := filter.With()
					params = append(recQryParams, params...)
					s := recQry + "\nSELECT dashboard.title FROM dashboard WHERE " + q
					leftJoin := filter.LeftJoin()
					if leftJoin != "" {
						s = recQry + "\nSELECT dashboard.title FROM dashboard LEFT OUTER JOIN " + leftJoin + " WHERE " + q + "ORDER BY dashboard.id ASC"
					}
					err := sess.SQL(s, params...).Find(&result)
					return err
				})
				require.NoError(t, err)
				assert.Equal(t, tc.expectedResult, result)
			})
		}
	}
}

func TestIntegration_DashboardNestedPermissionFilter_WithSelfContainedPermissions(t *testing.T) {
	testCases := []struct {
		desc                    string
		queryType               string
		permission              dashboardaccess.PermissionType
		signedInUserPermissions []accesscontrol.Permission
		expectedResult          []string
		features                []any
	}{
		{
			desc:                    "Should not be able to view dashboards under inherited folders with no permissions if nested folders are enabled",
			queryType:               searchstore.TypeDashboard,
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			features:                []any{featuremgmt.FlagNestedFolders},
			expectedResult:          nil,
		},
		{
			desc:                    "Should not be able to view inherited folders with no permissions if nested folders are enabled",
			queryType:               searchstore.TypeFolder,
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			features:                []any{featuremgmt.FlagNestedFolders},
			expectedResult:          nil,
		},
		{
			desc:                    "Should not be able to view inherited dashboards and folders with no permissions if nested folders are enabled",
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			features:                []any{featuremgmt.FlagNestedFolders},
			expectedResult:          nil,
		},
		{
			desc:       "Should be able to view dashboards under inherited folders with wildcard scope if nested folders are enabled",
			queryType:  searchstore.TypeDashboard,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			features:       []any{featuremgmt.FlagNestedFolders},
			expectedResult: []string{"dashboard under the root", "dashboard under parent folder", "dashboard under subfolder"},
		},
		{
			desc:       "Should be able to view inherited folders if nested folders are enabled",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:parent"},
			},
			features:       []any{featuremgmt.FlagNestedFolders},
			expectedResult: []string{"parent", "subfolder"},
		},
		{
			desc:       "Should not be able to view inherited folders if nested folders are not enabled",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:parent"},
			},
			features:       []any{},
			expectedResult: []string{"parent"},
		},
	}

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	var orgID int64 = 1

	for _, tc := range testCases {
		helperUser := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer, AuthenticatedBy: login.ExtendedJWTModule,
			Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), []accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersCreate,
				},
				{
					Action: dashboards.ActionFoldersWrite,
					Scope:  dashboards.ScopeFoldersAll,
				},
			}),
			},
		}
		for _, features := range []featuremgmt.FeatureToggles{featuremgmt.WithFeatures(tc.features...), featuremgmt.WithFeatures(append(tc.features, featuremgmt.FlagPermissionsFilterRemoveSubquery)...)} {
			m := features.GetEnabled(context.Background())
			keys := make([]string, 0, len(m))
			for k := range m {
				keys = append(keys, k)
			}

			t.Run(tc.desc+" with features "+strings.Join(keys, ","), func(t *testing.T) {
				usr := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer, AuthenticatedBy: login.ExtendedJWTModule, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), tc.signedInUserPermissions)}}
				db := setupNestedTest(t, helperUser, []accesscontrol.Permission{}, orgID, features)
				recursiveQueriesAreSupported, err := db.RecursiveQueriesAreSupported()
				require.NoError(t, err)
				filter := permissions.NewAccessControlDashboardPermissionFilter(usr, tc.permission, tc.queryType, features, recursiveQueriesAreSupported)
				var result []string
				err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					q, params := filter.Where()
					recQry, recQryParams := filter.With()
					params = append(recQryParams, params...)
					s := recQry + "\nSELECT dashboard.title FROM dashboard WHERE " + q
					leftJoin := filter.LeftJoin()
					if leftJoin != "" {
						s = recQry + "\nSELECT dashboard.title FROM dashboard LEFT OUTER JOIN " + leftJoin + " WHERE " + q + " ORDER BY dashboard.id ASC"
					}
					err := sess.SQL(s, params...).Find(&result)
					return err
				})
				require.NoError(t, err)
				assert.Equal(t, tc.expectedResult, result)
			})
		}
	}
}

func TestIntegration_DashboardNestedPermissionFilter_WithActionSets(t *testing.T) {
	testCases := []struct {
		desc                    string
		queryType               string
		permission              dashboardaccess.PermissionType
		signedInUserPermissions []accesscontrol.Permission
		expectedResult          []string
		features                []any
	}{
		{
			desc:                    "Should not list any dashboards if user has no permissions",
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			features:                []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult:          nil,
		},
		{
			desc:                    "Should not list any folders if user has no permissions",
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			features:                []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult:          nil,
		},
		{
			desc:       "Should be able to view folders if user has `folders:read` access to them",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
			},
			features:       []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"parent", "subfolder"},
		},
		{
			desc:       "Should be able to view folders if user has action set access to them",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: "folders:view", Scope: "folders:uid:parent", Kind: "folders", Identifier: "parent"},
			},
			features:       []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"parent", "subfolder"},
		},
		{
			desc:       "Should be able to view only the subfolder if user has action set access to it",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: "folders:admin", Scope: "folders:uid:subfolder", Kind: "folders", Identifier: "subfolder"},
			},
			features:       []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"subfolder"},
		},
		{
			desc:       "Should be able to filter for folders that user has write access to",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_EDIT,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: "folders:edit", Scope: "folders:uid:subfolder", Kind: "folders", Identifier: "subfolder"},
				{Action: "folders:view", Scope: "folders:uid:parent", Kind: "folders", Identifier: "parent"},
			},
			features:       []any{featuremgmt.FlagNestedFolders, featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"subfolder"},
		},
	}

	origNewGuardian := guardian.New
	guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
	t.Cleanup(func() {
		guardian.New = origNewGuardian
	})

	var orgID int64 = 1

	for _, tc := range testCases {
		tc.signedInUserPermissions = append(tc.signedInUserPermissions, accesscontrol.Permission{
			Action: dashboards.ActionFoldersCreate,
		}, accesscontrol.Permission{
			Action: dashboards.ActionFoldersWrite,
			Scope:  dashboards.ScopeFoldersAll,
		}, accesscontrol.Permission{
			Action: dashboards.ActionFoldersRead,
			Scope:  "folders:uid:unrelated"}, accesscontrol.Permission{
			Action: dashboards.ActionDashboardsCreate,
			Scope:  "folders:uid:unrelated"})
		usr := &user.SignedInUser{OrgID: orgID, OrgRole: org.RoleViewer, Permissions: map[int64]map[string][]string{orgID: accesscontrol.GroupScopesByActionContext(context.Background(), tc.signedInUserPermissions)}}

		for _, features := range []featuremgmt.FeatureToggles{featuremgmt.WithFeatures(tc.features...), featuremgmt.WithFeatures(append(tc.features, featuremgmt.FlagPermissionsFilterRemoveSubquery)...)} {
			m := features.GetEnabled(context.Background())
			keys := make([]string, 0, len(m))
			for k := range m {
				keys = append(keys, k)
			}

			t.Run(tc.desc+" with features "+strings.Join(keys, ","), func(t *testing.T) {
				db := setupNestedTest(t, usr, tc.signedInUserPermissions, orgID, features)
				recursiveQueriesAreSupported, err := db.RecursiveQueriesAreSupported()
				require.NoError(t, err)
				filter := permissions.NewAccessControlDashboardPermissionFilter(usr, tc.permission, tc.queryType, features, recursiveQueriesAreSupported)
				var result []string
				err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
					q, params := filter.Where()
					recQry, recQryParams := filter.With()
					params = append(recQryParams, params...)
					s := recQry + "\nSELECT dashboard.title FROM dashboard WHERE " + q
					leftJoin := filter.LeftJoin()
					if leftJoin != "" {
						s = recQry + "\nSELECT dashboard.title FROM dashboard LEFT OUTER JOIN " + leftJoin + " WHERE " + q + "ORDER BY dashboard.id ASC"
					}
					err := sess.SQL(s, params...).Find(&result)
					return err
				})
				require.NoError(t, err)
				assert.Equal(t, tc.expectedResult, result)
			})
		}
	}
}

func setupTest(t *testing.T, numFolders, numDashboards int, permissions []accesscontrol.Permission) db.DB {
	t.Helper()

	store := db.InitTestDB(t)
	err := store.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		dashes := make([]dashboards.Dashboard, 0, numFolders+numDashboards)
		for i := 1; i <= numFolders; i++ {
			str := strconv.Itoa(i)
			dashes = append(dashes, dashboards.Dashboard{
				OrgID:    1,
				Slug:     str,
				UID:      str,
				Title:    str,
				IsFolder: true,
				Data:     simplejson.New(),
				Created:  time.Now(),
				Updated:  time.Now(),
			})
		}
		// Seed dashboards
		for i := numFolders + 1; i <= numFolders+numDashboards; i++ {
			str := strconv.Itoa(i)
			folderID := 0
			if i%(numFolders+1) != 0 {
				folderID = i % (numFolders + 1)
			}
			dashes = append(dashes, dashboards.Dashboard{
				OrgID:     1,
				IsFolder:  false,
				FolderUID: strconv.Itoa(folderID),
				UID:       str,
				Slug:      str,
				Title:     str,
				Data:      simplejson.New(),
				Created:   time.Now(),
				Updated:   time.Now(),
			})
		}

		_, err := sess.InsertMulti(&dashes)
		if err != nil {
			return err
		}

		role := &accesscontrol.Role{
			OrgID:   0,
			UID:     "basic_viewer",
			Name:    "basic:viewer",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err = sess.Insert(role)
		if err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.BuiltinRole{
			OrgID:   0,
			RoleID:  role.ID,
			Role:    "Viewer",
			Created: time.Now(),
			Updated: time.Now(),
		})
		if err != nil {
			return err
		}

		for i := range permissions {
			permissions[i].RoleID = role.ID
			permissions[i].Created = time.Now()
			permissions[i].Updated = time.Now()
			permissions[i].Kind, permissions[i].Attribute, permissions[i].Identifier = permissions[i].SplitScope()
		}
		if len(permissions) > 0 {
			_, err = sess.InsertMulti(&permissions)
			if err != nil {
				return err
			}
		}

		return nil
	})
	require.NoError(t, err)
	return store
}

func setupNestedTest(t *testing.T, usr *user.SignedInUser, perms []accesscontrol.Permission, orgID int64, features featuremgmt.FeatureToggles) db.DB {
	t.Helper()

	db, cfg := db.InitTestDBWithCfg(t)

	// dashboard store commands that should be called.
	dashStore, err := database.ProvideDashboardStore(db, cfg, features, tagimpl.ProvideService(db), quotatest.New(false, nil))
	require.NoError(t, err)

	folderPermissions, err := testutil.ProvideFolderPermissions(features, cfg, db)
	require.NoError(t, err)
	fStore := folderimpl.ProvideStore(db)
	folderSvc := folderimpl.ProvideService(fStore, actest.FakeAccessControl{ExpectedEvaluate: true}, bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore,
		folderimpl.ProvideDashboardFolderStore(db), db, features, cfg, folderPermissions, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())
	// create parent folder
	parent, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
		UID:          "parent",
		OrgID:        orgID,
		Title:        "parent",
		SignedInUser: usr,
	})
	require.NoError(t, err)

	// create subfolder
	subfolder, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
		UID:          "subfolder",
		ParentUID:    "parent",
		OrgID:        orgID,
		Title:        "subfolder",
		SignedInUser: usr,
	})
	require.NoError(t, err)

	// create a root level dashboard
	_, err = dashStore.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID: orgID,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "dashboard under the root",
		}),
	})
	require.NoError(t, err)

	// create dashboard under parent folder
	_, err = dashStore.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID:     orgID,
		FolderUID: parent.UID,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "dashboard under parent folder",
		}),
	})
	require.NoError(t, err)

	// create dashboard under subfolder
	_, err = dashStore.SaveDashboard(context.Background(), dashboards.SaveDashboardCommand{
		OrgID:     orgID,
		FolderUID: subfolder.UID,
		Dashboard: simplejson.NewFromAny(map[string]any{
			"title": "dashboard under subfolder",
		}),
	})
	require.NoError(t, err)

	err = db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role := &accesscontrol.Role{
			OrgID:   0,
			UID:     "basic_viewer",
			Name:    "basic:viewer",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err = sess.Insert(role)
		if err != nil {
			return err
		}
		_, err = sess.Insert(accesscontrol.BuiltinRole{
			OrgID:   0,
			RoleID:  role.ID,
			Role:    "Viewer",
			Created: time.Now(),
			Updated: time.Now(),
		})
		if err != nil {
			return err
		}

		for i := range perms {
			perms[i].RoleID = role.ID
			perms[i].Created = time.Now()
			perms[i].Updated = time.Now()
			perms[i].Kind, perms[i].Attribute, perms[i].Identifier = perms[i].SplitScope()
		}
		if len(perms) > 0 {
			_, err = sess.InsertMulti(&perms)
			if err != nil {
				return err
			}
		}

		return nil
	})
	require.NoError(t, err)

	return db
}
