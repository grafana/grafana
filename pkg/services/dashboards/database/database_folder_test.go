package database

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
		var currentUser user.User
		var dashboardStore dashboards.Store

		setup := func() {
			sqlStore = db.InitTestDB(t)
			sqlStore.Cfg.RBACEnabled = false
			quotaService := quotatest.New(false, nil)
			var err error
			dashboardStore, err = ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
			require.NoError(t, err)
			flder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod", "webapp")
			childDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, flder.ID, false, "prod", "webapp")
			insertTestDashboard(t, dashboardStore, "test dash 45", 1, flder.ID, false, "prod")
			currentUser = createUser(t, sqlStore, "viewer", "Viewer", false)
		}

		t.Run("Given one dashboard folder with two dashboards and one dashboard in the root folder", func(t *testing.T) {
			setup()

			t.Run("and no acls are set", func(t *testing.T) {
				t.Run("should return all dashboards", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
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

			t.Run("and acl is set for dashboard folder", func(t *testing.T) {
				var otherUser int64 = 999
				err := updateDashboardACL(t, dashboardStore, flder.ID, dashboards.DashboardACL{
					DashboardID: flder.ID,
					OrgID:       1,
					UserID:      otherUser,
					Permission:  dashboards.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						OrgId:        1, DashboardIds: []int64{flder.ID, dashInRoot.ID},
					}
					hits, err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)

					require.Equal(t, len(hits), 1)
					require.Equal(t, hits[0].ID, dashInRoot.ID)
				})

				t.Run("when the user is given permission", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, flder.ID, dashboards.DashboardACL{
						DashboardID: flder.ID, OrgID: 1, UserID: currentUser.ID, Permission: dashboards.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to access folder", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
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

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to access folder", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{
								UserID:  currentUser.ID,
								OrgID:   1,
								OrgRole: org.RoleAdmin,
							},
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
			})

			t.Run("and acl is set for dashboard child and folder has all permissions removed", func(t *testing.T) {
				var otherUser int64 = 999
				err := updateDashboardACL(t, dashboardStore, flder.ID)
				require.NoError(t, err)
				err = updateDashboardACL(t, dashboardStore, childDash.ID, dashboards.DashboardACL{
					DashboardID: flder.ID, OrgID: 1, UserID: otherUser, Permission: dashboards.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder or child", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer}, OrgId: 1, DashboardIds: []int64{flder.ID, childDash.ID, dashInRoot.ID},
					}
					hits, err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(hits), 1)
					require.Equal(t, hits[0].ID, dashInRoot.ID)
				})

				t.Run("when the user is given permission to child", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, childDash.ID, dashboards.DashboardACL{
						DashboardID: childDash.ID, OrgID: 1, UserID: currentUser.ID, Permission: dashboards.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to search for child dashboard but not folder", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer}, OrgId: 1, DashboardIds: []int64{flder.ID, childDash.ID, dashInRoot.ID}}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(hits), 2)
						require.Equal(t, hits[0].ID, childDash.ID)
						require.Equal(t, hits[1].ID, dashInRoot.ID)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to search for child dash and folder", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{
								UserID:  currentUser.ID,
								OrgID:   1,
								OrgRole: org.RoleAdmin,
							},
							OrgId:        1,
							DashboardIds: []int64{flder.ID, dashInRoot.ID, childDash.ID},
						}
						hits, err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(hits), 3)
						require.Equal(t, hits[0].ID, flder.ID)
						require.Equal(t, hits[1].ID, childDash.ID)
						require.Equal(t, hits[2].ID, dashInRoot.ID)
					})
				})
			})
		})

		t.Run("Given two dashboard folders with one dashboard each and one dashboard in the root folder", func(t *testing.T) {
			var sqlStore *sqlstore.SQLStore
			var folder1, folder2, dashInRoot, childDash1, childDash2 *dashboards.Dashboard
			var currentUser user.User
			var rootFolderId int64 = 0

			setup2 := func() {
				sqlStore = db.InitTestDB(t)
				quotaService := quotatest.New(false, nil)
				dashboardStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
				require.NoError(t, err)
				folder1 = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod")
				folder2 = insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, true, "prod")
				dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod")
				childDash1 = insertTestDashboard(t, dashboardStore, "child dash 1", 1, folder1.ID, false, "prod")
				childDash2 = insertTestDashboard(t, dashboardStore, "child dash 2", 1, folder2.ID, false, "prod")

				currentUser = createUser(t, sqlStore, "viewer", "Viewer", false)
			}

			setup2()
			t.Run("and one folder is expanded, the other collapsed", func(t *testing.T) {
				t.Run("should return dashboards in root and expanded folder", func(t *testing.T) {
					query := &dashboards.FindPersistedDashboardsQuery{
						FolderIds: []int64{
							rootFolderId, folder1.ID}, SignedInUser: &user.SignedInUser{UserID: currentUser.ID,
							OrgID: 1, OrgRole: org.RoleViewer,
						},
						OrgId: 1,
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
				const otherUser int64 = 999
				err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
					DashboardID: folder1.ID, OrgID: 1, UserID: otherUser, Permission: dashboards.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("and a dashboard is moved from folder without acl to the folder with an acl", func(t *testing.T) {
					moveDashboard(t, dashboardStore, 1, childDash2.Data, folder1.ID)

					t.Run("should not return folder with acl or its children", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
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

					t.Run("should return folder without acl and its children", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
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

				t.Run("and a dashboard with an acl is moved to the folder without an acl", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, childDash1.ID, dashboards.DashboardACL{
						DashboardID: childDash1.ID, OrgID: 1, UserID: otherUser, Permission: dashboards.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.ID)

					t.Run("should return folder without acl but not the dashboard with acl", func(t *testing.T) {
						query := &dashboards.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
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

		t.Run("Given two dashboard folders", func(t *testing.T) {
			var sqlStore *sqlstore.SQLStore
			var folder1, folder2 *dashboards.Dashboard
			var adminUser, editorUser, viewerUser user.User

			setup3 := func() {
				sqlStore = db.InitTestDB(t)
				quotaService := quotatest.New(false, nil)
				dashboardStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
				require.NoError(t, err)
				folder1 = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod")
				folder2 = insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, true, "prod")
				insertTestDashboard(t, dashboardStore, "folder in another org", 2, 0, true, "prod")

				adminUser = createUser(t, sqlStore, "admin", "Admin", true)
				editorUser = createUser(t, sqlStore, "editor", "Editor", false)
				viewerUser = createUser(t, sqlStore, "viewer", "Viewer", false)
			}

			setup3()
			t.Run("Admin users", func(t *testing.T) {
				t.Run("Should have write access to all dashboard folders in their org", func(t *testing.T) {
					query := dashboards.FindPersistedDashboardsQuery{
						OrgId:        1,
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgRole: org.RoleAdmin, OrgID: 1},
						Permission:   dashboards.PERMISSION_VIEW,
						Type:         "dash-folder",
					}

					hits, err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(hits), 2)
					require.Equal(t, hits[0].ID, folder1.ID)
					require.Equal(t, hits[1].ID, folder2.ID)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &folder.HasEditPermissionInFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleAdmin},
					}
					queryResult, err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					require.NoError(t, err)
					require.True(t, queryResult)
				})

				t.Run("should have admin permission in folders", func(t *testing.T) {
					query := &folder.HasAdminPermissionInDashboardsOrFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleAdmin},
					}
					queryResult, err := dashboardStore.HasAdminPermissionInDashboardsOrFolders(context.Background(), query)
					require.NoError(t, err)
					require.True(t, queryResult)
				})
			})

			t.Run("Editor users", func(t *testing.T) {
				query := dashboards.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &user.SignedInUser{UserID: editorUser.ID, OrgRole: org.RoleEditor, OrgID: 1},
					Permission:   dashboards.PERMISSION_EDIT,
				}

				t.Run("Should have write access to all dashboard folders with default ACL", func(t *testing.T) {
					hits, err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(hits), 2)
					require.Equal(t, hits[0].ID, folder1.ID)
					require.Equal(t, hits[1].ID, folder2.ID)
				})

				t.Run("Should have write access to one dashboard folder if default role changed to view for one folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: editorUser.ID, Permission: dashboards.PERMISSION_VIEW,
					})
					require.NoError(t, err)

					hits, err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(hits), 1)
					require.Equal(t, hits[0].ID, folder2.ID)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &folder.HasEditPermissionInFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: editorUser.ID, OrgID: 1, OrgRole: org.RoleEditor},
					}
					queryResult, err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					go require.NoError(t, err)
					require.True(t, queryResult)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &folder.HasAdminPermissionInDashboardsOrFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleEditor},
					}
					queryResult, err := dashboardStore.HasAdminPermissionInDashboardsOrFolders(context.Background(), query)
					require.NoError(t, err)
					require.False(t, queryResult)
				})
			})

			t.Run("Viewer users", func(t *testing.T) {
				query := dashboards.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgRole: org.RoleViewer, OrgID: 1},
					Permission:   dashboards.PERMISSION_EDIT,
				}

				t.Run("Should have no write access to any dashboard folders with default ACL", func(t *testing.T) {
					hits, err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(hits), 0)
				})

				t.Run("Should be able to get one dashboard folder if default role changed to edit for one folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: viewerUser.ID, Permission: dashboards.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					hits, err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(hits), 1)
					require.Equal(t, hits[0].ID, folder1.ID)
				})

				t.Run("should not have edit permission in folders", func(t *testing.T) {
					setup3()

					query := &folder.HasEditPermissionInFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
					}
					queryResult, err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					go require.NoError(t, err)
					require.False(t, queryResult)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &folder.HasAdminPermissionInDashboardsOrFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
					}
					queryResult, err := dashboardStore.HasAdminPermissionInDashboardsOrFolders(context.Background(), query)
					require.NoError(t, err)
					require.False(t, queryResult)
				})

				t.Run("and admin permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: viewerUser.ID, Permission: dashboards.PERMISSION_ADMIN,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &folder.HasEditPermissionInFoldersQuery{
							SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						}
						queryResult, err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
						go require.NoError(t, err)
						require.True(t, queryResult)
					})
				})

				t.Run("and edit permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: viewerUser.ID, Permission: dashboards.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &folder.HasEditPermissionInFoldersQuery{
							SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						}
						queryResult, err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
						go require.NoError(t, err)
						require.True(t, queryResult)
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
	var viewer user.SignedInUser
	var role *accesscontrol.Role

	setup := func() {
		sqlStore = db.InitTestDB(t)
		sqlStore.Cfg.RBACEnabled = true
		quotaService := quotatest.New(false, nil)

		// enable nested folders so that the folder table is populated for all the tests
		features := featuremgmt.WithFeatures(featuremgmt.FlagNestedFolders)

		var err error
		dashboardWriteStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, features, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
		require.NoError(t, err)

		usr := createUser(t, sqlStore, "viewer", "Viewer", false)
		viewer = user.SignedInUser{
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

		role = setupRBACRole(t, *sqlStore, &viewer)
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
			setupRBACPermission(t, *sqlStore, role, &viewer)

			query := &dashboards.FindPersistedDashboardsQuery{
				SignedInUser: &viewer,
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

func setupRBACRole(t *testing.T, db sqlstore.SQLStore, user *user.SignedInUser) *accesscontrol.Role {
	t.Helper()
	var role *accesscontrol.Role
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		role = &accesscontrol.Role{
			OrgID:   user.OrgID,
			UID:     "test_role",
			Name:    "test:role",
			Updated: time.Now(),
			Created: time.Now(),
		}
		_, err := sess.Insert(role)
		if err != nil {
			return err
		}

		_, err = sess.Insert(accesscontrol.UserRole{
			OrgID:   role.OrgID,
			RoleID:  role.ID,
			UserID:  user.UserID,
			Created: time.Now(),
		})
		if err != nil {
			return err
		}
		return nil
	})

	require.NoError(t, err)
	return role
}

func setupRBACPermission(t *testing.T, db sqlstore.SQLStore, role *accesscontrol.Role, user *user.SignedInUser) {
	t.Helper()
	err := db.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		if _, err := sess.Exec("DELETE FROM permission WHERE role_id = ?", role.ID); err != nil {
			return err
		}

		var acPermission []accesscontrol.Permission
		for action, scopes := range user.Permissions[user.OrgID] {
			for _, scope := range scopes {
				acPermission = append(acPermission, accesscontrol.Permission{
					RoleID: role.ID, Action: action, Scope: scope, Created: time.Now(), Updated: time.Now(),
				})
			}
		}

		if _, err := sess.InsertMulti(&acPermission); err != nil {
			return err
		}

		return nil
	})

	require.NoError(t, err)
}
