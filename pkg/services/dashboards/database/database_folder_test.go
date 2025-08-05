package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var testFeatureToggles = featuremgmt.WithFeatures(featuremgmt.FlagPanelTitleSearch)

func TestIntegrationDashboardFolderDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing DB", func(t *testing.T) {
		var sqlStore db.DB
		var cfg *setting.Cfg
		var flder, dashInRoot, childDash *dashboards.Dashboard
		var currentUser *user.SignedInUser
		var dashboardStore dashboards.Store
		var folderStore *folderimpl.FolderStoreImpl

		setup := func() {
			sqlStore, cfg = db.InitTestDBWithCfg(t)
			var err error
			dashboardStore, err = ProvideDashboardStore(sqlStore, cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore))
			require.NoError(t, err)
			folderStore = folderimpl.ProvideStore(sqlStore)
			require.NoError(t, err)
			flder = insertTestDashFolder(t, dashboardStore, folderStore, "1 test dash folder", 1, 0, "", "prod", "webapp")
			dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, "", false, "prod", "webapp")
			childDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, flder.ID, flder.UID, false, "prod", "webapp")
			insertTestDashboard(t, dashboardStore, "test dash 45", 1, flder.ID, flder.UID, false, "prod")
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
			var sqlStore db.DB
			var folder1, folder2, dashInRoot, childDash1, childDash2 *dashboards.Dashboard
			var rootFolderId int64 = 0
			var currentUser *user.SignedInUser

			setup2 := func() {
				sqlStore, cfg = db.InitTestDBWithCfg(t)
				var err error
				require.NoError(t, err)
				folder1 = insertTestDashFolder(t, dashboardStore, folderStore, "1 test dash folder", 1, 0, "", "prod")
				folder2 = insertTestDashFolder(t, dashboardStore, folderStore, "2 test dash folder", 1, 0, "", "prod")
				dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, "", false, "prod")
				childDash1 = insertTestDashboard(t, dashboardStore, "child dash 1", 1, folder1.ID, folder1.UID, false, "prod")
				childDash2 = insertTestDashboard(t, dashboardStore, "child dash 2", 1, folder2.ID, folder2.UID, false, "prod")

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
						}, // nolint:staticcheck
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
					moveDashboard(t, dashboardStore, 1, childDash2.Data, folder1.ID, folder1.UID)
					currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2.UID), dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashInRoot.UID)}}}
					actest.AddUserPermissionToDB(t, sqlStore, currentUser)

					t.Run("should not return folder with acl or its children", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser:  currentUser,
							OrgId:         1,
							DashboardIds:  []int64{folder1.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
							DashboardUIDs: []string{folder1.UID, childDash1.UID, childDash2.UID, dashInRoot.UID},
						}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(hits), 1)
						require.Equal(t, hits[0].ID, dashInRoot.ID)
					})
				})
				t.Run("and a dashboard is moved from folder with acl to the folder without an acl", func(t *testing.T) {
					setup2()
					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.ID, folder2.UID)
					currentUser.Permissions = map[int64]map[string][]string{1: {dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dashInRoot.UID), dashboards.ScopeDashboardsProvider.GetResourceScopeUID(folder2.UID), dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2.UID)}, dashboards.ActionFoldersRead: {dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder2.UID)}}}
					actest.AddUserPermissionToDB(t, sqlStore, currentUser)

					t.Run("should return folder without acl and its children", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: currentUser,
							OrgId:        1,
							DashboardIds: []int64{folder2.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
						}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						for _, hit := range hits {
							fmt.Println(hit)
						}
						assert.Equal(t, 4, len(hits))
						assert.Equal(t, hits[0].ID, folder2.ID)
						assert.Equal(t, hits[1].ID, childDash1.ID)
						assert.Equal(t, hits[2].ID, childDash2.ID)
						assert.Equal(t, hits[3].ID, dashInRoot.ID)
					})
				})
			})
		})
	})
}

func moveDashboard(t *testing.T, dashboardStore dashboards.Store, orgId int64, dashboard *simplejson.Json,
	newFolderId int64, newFolderUID string) *dashboards.Dashboard {
	t.Helper()

	cmd := dashboards.SaveDashboardCommand{
		OrgID:     orgId,
		FolderID:  newFolderId, // nolint:staticcheck
		FolderUID: newFolderUID,
		Dashboard: dashboard,
		Overwrite: true,
	}
	dash, err := dashboardStore.SaveDashboard(context.Background(), cmd)
	require.NoError(t, err)

	return dash
}
