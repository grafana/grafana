package database

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
)

var testFeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch)

func TestIntegrationDashboardFolderDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing DB", func(t *testing.T) {
		var sqlStore *sqlstore.SQLStore
		var flder, dashInRoot, childDash *dashboards.Dashboard
		var currentUser *user.SignedInUser
		var dashboardStore dashboards.Store

		setup := func() {
			sqlStore = db.InitTestDB(t)
			quotaService := quotatest.New(false, nil)
			var err error
			dashboardStore, err = ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
			require.NoError(t, err)
			flder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod", "webapp")
			childDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, flder.ID, false, "prod", "webapp")
			insertTestDashboard(t, dashboardStore, "test dash 45", 1, flder.ID, false, "prod")
			currentUser = &user.SignedInUser{
				UserID:  1,
				OrgID:   1,
				OrgRole: org.RoleViewer,
			}
		}

		t.Run("Given one dashboard folder with two dashboards and one dashboard in the root folder", func(t *testing.T) {
			setup()

			t.Run("and user can read folders and dashboards", func(t *testing.T) {
				currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll},
					dashboards.ActionFoldersRead: []string{dashboards.ScopeFoldersAll}}}
				actest.AddUserPermissionToDB(t, sqlStore, currentUser)

				t.Run("should return all dashboards and folders", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						SignedInUser: currentUser,
						OrgId:        1,
						DashboardIds: []int64{flder.ID, dashInRoot.ID},
					}
					hits, err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(hits), 2)
					require.Equal(t, hits[0].ID, flder.ID)
					require.Equal(t, hits[1].ID, dashInRoot.ID)
				})
			})

			t.Run("and user can only read dashboards", func(t *testing.T) {
				currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: []string{dashboards.ScopeDashboardsAll}}}
				actest.AddUserPermissionToDB(t, sqlStore, currentUser)

				t.Run("should not return folder", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						SignedInUser: currentUser,
						OrgId:        1,
						DashboardIds: []int64{flder.ID, dashInRoot.ID},
					}
					hits, err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)

					require.Equal(t, 1, len(hits))
					require.Equal(t, hits[0].ID, dashInRoot.ID)
				})
			})

			t.Run("and permissions are set for dashboard child and folder has all permissions removed", func(t *testing.T) {
				currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashInRoot.UID)}}}
				actest.AddUserPermissionToDB(t, sqlStore, currentUser)

				t.Run("should not return folder or child", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						SignedInUser: currentUser,
						DashboardIds: []int64{flder.ID, childDash.ID, dashInRoot.ID},
					}
					hits, err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, 1, len(hits))
					require.Equal(t, hits[0].ID, dashInRoot.ID)
				})

				t.Run("when the user is given permission to child", func(t *testing.T) {
					currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll}}}
					actest.AddUserPermissionToDB(t, sqlStore, currentUser)

					t.Run("should be able to search for child dashboard but not folder", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: currentUser,
							OrgId:        1,
							DashboardIds: []int64{flder.ID, childDash.ID, dashInRoot.ID},
						}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, 2, len(hits))
						require.Equal(t, hits[0].ID, childDash.ID)
						require.Equal(t, hits[1].ID, dashInRoot.ID)
					})
				})
			})
		})

		t.Run("Given two dashboard folders with one dashboard each and one dashboard in the root folder", func(t *testing.T) {
			var sqlStore *sqlstore.SQLStore
			var folder1, folder2, dashInRoot, childDash1, childDash2 *dashboards.Dashboard
			var rootFolderId int64 = 0
			var currentUser *user.SignedInUser

			setup2 := func() {
				sqlStore = db.InitTestDB(t)
				quotaService := quotatest.New(false, nil)
				var err error
				dashboardStore, err = ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
				require.NoError(t, err)
				folder1 = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod")
				folder2 = insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, true, "prod")
				dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod")
				childDash1 = insertTestDashboard(t, dashboardStore, "child dash 1", 1, folder1.ID, false, "prod")
				childDash2 = insertTestDashboard(t, dashboardStore, "child dash 2", 1, folder2.ID, false, "prod")

				currentUser = &user.SignedInUser{
					UserID:  1,
					OrgID:   1,
					OrgRole: org.RoleViewer,
				}
			}

			setup2()
			t.Run("and one folder is expanded, the other collapsed", func(t *testing.T) {
				currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll}, dashboards.ActionFoldersRead: []string{dashboards.ScopeFoldersAll}}}
				actest.AddUserPermissionToDB(t, sqlStore, currentUser)

				t.Run("should return dashboards in root and expanded folder", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						FolderIds: []int64{
							rootFolderId,
							folder1.ID,
						},
						SignedInUser: currentUser,
						OrgId:        1,
					}
					hits, err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(hits), 4)
					require.Equal(t, hits[0].ID, folder1.ID)
					require.Equal(t, hits[1].ID, folder2.ID)
					require.Equal(t, hits[2].ID, childDash1.ID)
					require.Equal(t, hits[3].ID, dashInRoot.ID)
				})
			})

			t.Run("and acl is set for one dashboard folder", func(t *testing.T) {
				t.Run("and a dashboard is moved from folder without acl to the folder with an acl", func(t *testing.T) {
					moveDashboard(t, dashboardStore, 1, childDash2.Data, folder1.ID)
					currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2.UID), dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashInRoot.UID)}}}
					actest.AddUserPermissionToDB(t, sqlStore, currentUser)

					t.Run("should not return folder with acl or its children", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: currentUser,
							OrgId:        1,
							DashboardIds: []int64{folder1.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
						}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(hits), 1)
						require.Equal(t, hits[0].ID, dashInRoot.ID)
					})
				})
				t.Run("and a dashboard is moved from folder with acl to the folder without an acl", func(t *testing.T) {
					setup2()
					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.ID)
					currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashInRoot.UID), dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2.UID)}, dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2.UID)}}}
					actest.AddUserPermissionToDB(t, sqlStore, currentUser)

					t.Run("should return folder without acl and its children", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: currentUser,
							OrgId:        1,
							DashboardIds: []int64{folder2.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
						}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(hits), 4)
						require.Equal(t, hits[0].ID, folder2.ID)
						require.Equal(t, hits[1].ID, childDash1.ID)
						require.Equal(t, hits[2].ID, childDash2.ID)
						require.Equal(t, hits[3].ID, dashInRoot.ID)
					})
				})
			})
		})
	})
}

func TestIntegrationDashboardInheritedFolderRBAC(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// the maximux nested folder hierarchy starting from parent down to subfolders
	nestedFolders := make([]*folder.Folder, 0, folder.MaxNestedFolderDepth+1)

	var sqlStore *sqlstore.SQLStore
	const (
		dashInRootTitle      = "dashboard in root"
		dashInParentTitle    = "dashboard in parent"
		dashInSubfolderTitle = "dashboard in subfolder"
	)
	var viewer *user.SignedInUser

	setup := func() {
		sqlStore = db.InitTestDB(t)
		quotaService := quotatest.New(false, nil)

		// enable nested folders so that the folder table is populated for all the tests
		features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)

		var err error
		dashboardWriteStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, features, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)

		usr := createUser(t, sqlStore, "viewer", "Viewer", false)
		viewer = &user.SignedInUser{
			UserID:  usr.ID,
			OrgID:   usr.OrgID,
			OrgRole: org.RoleViewer,
		}

		orgService, err := orgimpl.ProvideService(sqlStore, sqlStore.Cfg, quotaService)
		require.NoError(t, err)
		usrSvc, err := userimpl.ProvideService(sqlStore, orgService, sqlStore.Cfg, nil, nil, quotaService, supportbundlestest.NewFakeBundleService())
		require.NoError(t, err)

		// create admin user in the same org
		currentUserCmd := user.CreateUserCommand{Login: "admin", Email: "admin@test.com", Name: "an admin", IsAdmin: false, OrgID: viewer.OrgID}
		u, err := usrSvc.Create(context.Background(), &currentUserCmd)
		require.NoError(t, err)
		admin := user.SignedInUser{
			UserID:  u.ID,
			OrgID:   u.OrgID,
			OrgRole: org.RoleAdmin,
			Permissions: map[int64]map[string][]string{u.OrgID: accesscontrol.GroupScopesByAction([]accesscontrol.Permission{
				{
					Action: dashboards.ActionFoldersCreate,
				}, {
					Action: dashboards.ActionFoldersWrite,
					Scope:  dashboards.ScopeFoldersAll,
				}}),
			},
		}
		require.NotEqual(t, viewer.UserID, admin.UserID)

		origNewGuardian := guardian.New
		guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanViewValue: true, CanSaveValue: true})
		t.Cleanup(func() {
			guardian.New = origNewGuardian
		})

		folderSvc := folderimpl.ProvideService(mock.New(), bus.ProvideBus(tracing.InitializeTracerForTest()), sqlStore.Cfg, dashboardWriteStore, folderimpl.ProvideDashboardFolderStore(sqlStore), sqlStore, features)

		parentUID := ""
		for i := 0; ; i++ {
			uid := fmt.Sprintf("f%d", i)
			f, err := folderSvc.Create(context.Background(), &folder.CreateFolderCommand{
				UID:          uid,
				OrgID:        admin.OrgID,
				Title:        uid,
				SignedInUser: &admin,
				ParentUID:    parentUID,
			})
			if err != nil {
				if errors.Is(err, folder.ErrMaximumDepthReached) {
					break
				}

				t.Log("unexpected error", "error", err)
				t.Fail()
			}

			nestedFolders = append(nestedFolders, f)

			parentUID = f.UID
		}
		require.LessOrEqual(t, 2, len(nestedFolders))

		saveDashboardCmd := dashboards.SaveDashboardCommand{
			UserID:   admin.UserID,
			OrgID:    admin.OrgID,
			IsFolder: false,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": dashInRootTitle,
			}),
		}
		_, err = dashboardWriteStore.SaveDashboard(context.Background(), saveDashboardCmd)
		require.NoError(t, err)

		saveDashboardCmd = dashboards.SaveDashboardCommand{
			UserID:   admin.UserID,
			OrgID:    admin.OrgID,
			IsFolder: false,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": dashInParentTitle,
			}),
			FolderID:  nestedFolders[0].ID,
			FolderUID: nestedFolders[0].UID,
		}
		_, err = dashboardWriteStore.SaveDashboard(context.Background(), saveDashboardCmd)
		require.NoError(t, err)

		saveDashboardCmd = dashboards.SaveDashboardCommand{
			UserID:   admin.UserID,
			OrgID:    admin.OrgID,
			IsFolder: false,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"title": dashInSubfolderTitle,
			}),
			FolderID:  nestedFolders[1].ID,
			FolderUID: nestedFolders[1].UID,
		}
		_, err = dashboardWriteStore.SaveDashboard(context.Background(), saveDashboardCmd)
		require.NoError(t, err)
	}

	setup()

	nestedFolderTitles := make([]string, 0, len(nestedFolders))
	for _, f := range nestedFolders {
		nestedFolderTitles = append(nestedFolderTitles, f.Title)
	}

	testCases := []struct {
		desc           string
		features       featuremgmt.FeatureToggles
		permissions    map[string][]string
		expectedTitles []string
	}{
		{
			desc:           "it should not return folder if ACL is not set for parent folder",
			features:       featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
			permissions:    nil,
			expectedTitles: nil,
		},
		{
			desc:     "it should not return dashboard in subfolder if nested folders are disabled and the user has permission to read dashboards under parent folder",
			features: featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
			permissions: map[string][]string{
				dashboards.ActionDashboardsRead: {fmt.Sprintf("folders:uid:%s", nestedFolders[0].UID)},
			},
			expectedTitles: []string{dashInParentTitle},
		},
		{
			desc:     "it should return dashboard in subfolder if nested folders are enabled and the user has permission to read dashboards under parent folder",
			features: featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch, featuremgmt.FlagNestedFolders),
			permissions: map[string][]string{
				dashboards.ActionDashboardsRead: {fmt.Sprintf("folders:uid:%s", nestedFolders[0].UID)},
			},
			expectedTitles: []string{dashInParentTitle, dashInSubfolderTitle},
		},
		{
			desc:     "it should not return subfolder if nested folders are disabled and the user has permission to read folders under parent folder",
			features: featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch),
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {fmt.Sprintf("folders:uid:%s", nestedFolders[0].UID)},
			},
			expectedTitles: []string{nestedFolders[0].Title},
		},
		{
			desc:     "it should return subfolder if nested folders are enabled and the user has permission to read folders under parent folder",
			features: featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch, featuremgmt.FlagNestedFolders),
			permissions: map[string][]string{
				dashboards.ActionFoldersRead: {fmt.Sprintf("folders:uid:%s", nestedFolders[0].UID)},
			},
			expectedTitles: nestedFolderTitles,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			dashboardReadStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, tc.features, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotatest.New(false, nil))
			require.NoError(t, err)

			viewer.Permissions = map[int64]map[string][]string{viewer.OrgID: tc.permissions}
			actest.AddUserPermissionToDB(t, sqlStore, viewer)

			query := &dashboards.FindPersistedDashboardsQuery{
				SignedInUser: viewer,
				OrgId:        viewer.OrgID,
			}

			res, err := testSearchDashboards(dashboardReadStore, query)
			require.NoError(t, err)

			require.Equal(t, len(tc.expectedTitles), len(res))
			for i, tlt := range tc.expectedTitles {
				assert.Equal(t, tlt, res[i].Title)
			}
		})
	}
}

func moveDashboard(t *testing.T, dashboardStore dashboards.Store, orgId int64, dashboard *simplejson.Json,
	newFolderId int64) *dashboards.Dashboard {
	t.Helper()

	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		FolderID:  newFolderId,
		Dashboard: dashboard,
		Overwrite: true,
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)

	return dash
}
