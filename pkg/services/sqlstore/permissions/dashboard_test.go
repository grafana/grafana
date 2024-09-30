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
			desc:           "Should not be able to view dashboards under inherited folders with no permissions",
			queryType:      searchstore.TypeDashboard,
			permission:     dashboardaccess.PERMISSION_VIEW,
			permissions:    nil,
			expectedResult: nil,
		},
		{
			desc:           "Should not be able to view inherited folders with no permissions",
			queryType:      searchstore.TypeFolder,
			permission:     dashboardaccess.PERMISSION_VIEW,
			permissions:    nil,
			expectedResult: nil,
		},
		{
			desc:           "Should not be able to view inherited dashboards and folders with no permissions",
			permission:     dashboardaccess.PERMISSION_VIEW,
			permissions:    nil,
			expectedResult: nil,
		},
		{
			desc:       "Should be able to view dashboards under inherited folders with wildcard scope",
			queryType:  searchstore.TypeDashboard,
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			features:       []any{featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"dashboard under the root", "dashboard under parent folder", "dashboard under subfolder"},
		},
		{
			desc:       "Should be able to view inherited folders",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			permissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:parent", Kind: "folders", Identifier: "parent"},
			},
			expectedResult: []string{"parent", "subfolder"},
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

		for _, features := range []featuremgmt.FeatureToggles{featuremgmt.WithFeatures(append(tc.features, featuremgmt.FlagAccessActionSets)...), featuremgmt.WithFeatures(append(tc.features, featuremgmt.FlagPermissionsFilterRemoveSubquery)...)} {
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
			desc:                    "Should not be able to view dashboards under inherited folders with no permissions",
			queryType:               searchstore.TypeDashboard,
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			expectedResult:          nil,
		},
		{
			desc:                    "Should not be able to view inherited folders with no permissions",
			queryType:               searchstore.TypeFolder,
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			expectedResult:          nil,
		},
		{
			desc:                    "Should not be able to view inherited dashboards and folders with no permissions",
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			expectedResult:          nil,
		},
		{
			desc:       "Should be able to view dashboards under inherited folders with wildcard scope",
			queryType:  searchstore.TypeDashboard,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeFoldersAll},
			},
			expectedResult: []string{"dashboard under the root", "dashboard under parent folder", "dashboard under subfolder"},
		},
		{
			desc:       "Should be able to view inherited folders",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: "folders:uid:parent"},
			},
			expectedResult: []string{"parent", "subfolder"},
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
			features:                []any{featuremgmt.FlagAccessActionSets},
			expectedResult:          nil,
		},
		{
			desc:                    "Should not list any folders if user has no permissions",
			permission:              dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: nil,
			features:                []any{featuremgmt.FlagAccessActionSets},
			expectedResult:          nil,
		},
		{
			desc:       "Should be able to view folders if user has `folders:read` access to them",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
			},
			features:       []any{featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"parent", "subfolder"},
		},
		{
			desc:       "Should be able to view folders if user has action set access to them",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: "folders:view", Scope: "folders:uid:parent", Kind: "folders", Identifier: "parent"},
			},
			features:       []any{featuremgmt.FlagAccessActionSets},
			expectedResult: []string{"parent", "subfolder"},
		},
		{
			desc:       "Should be able to view only the subfolder if user has action set access to it",
			queryType:  searchstore.TypeFolder,
			permission: dashboardaccess.PERMISSION_VIEW,
			signedInUserPermissions: []accesscontrol.Permission{
				{Action: "folders:admin", Scope: "folders:uid:subfolder", Kind: "folders", Identifier: "subfolder"},
			},
			features:       []any{featuremgmt.FlagAccessActionSets},
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
			features:       []any{featuremgmt.FlagAccessActionSets},
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

	folderSvc := folderimpl.ProvideService(actest.FakeAccessControl{ExpectedEvaluate: true}, bus.ProvideBus(tracing.InitializeTracerForTest()), dashStore, folderimpl.ProvideDashboardFolderStore(db), db, features, supportbundlestest.NewFakeBundleService(), nil, tracing.InitializeTracerForTest())

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
