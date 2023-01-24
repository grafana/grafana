package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
		var sqlStore *sqlstore.SQLStore
		var folder, dashInRoot, childDash *dashboards.Dashboard
		var currentUser user.User
		var dashboardStore *DashboardStore

		setup := func() {
			sqlStore = db.InitTestDB(t)
			sqlStore.Cfg.RBACEnabled = false
			quotaService := quotatest.New(false, nil)
			var err error
			dashboardStore, err = ProvideDashboardStore(sqlStore, &setting.Cfg{}, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
			require.NoError(t, err)
			folder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod", "webapp")
			childDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, folder.ID, false, "prod", "webapp")
			insertTestDashboard(t, dashboardStore, "test dash 45", 1, folder.ID, false, "prod")
			currentUser = createUser(t, sqlStore, "viewer", "Viewer", false)
		}

		t.Run("Given one dashboard folder with two dashboards and one dashboard in the root folder", func(t *testing.T) {
			setup()

			t.Run("and no acls are set", func(t *testing.T) {
				t.Run("should return all dashboards", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						OrgId:        1,
						DashboardIds: []int64{folder.ID, dashInRoot.ID},
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].ID, folder.ID)
					require.Equal(t, query.Result[1].ID, dashInRoot.ID)
				})
			})

			t.Run("and acl is set for dashboard folder", func(t *testing.T) {
				var otherUser int64 = 999
				err := updateDashboardACL(t, dashboardStore, folder.ID, dashboards.DashboardACL{
					DashboardID: folder.ID,
					OrgID:       1,
					UserID:      otherUser,
					Permission:  models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						OrgId:        1, DashboardIds: []int64{folder.ID, dashInRoot.ID},
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, dashInRoot.ID)
				})

				t.Run("when the user is given permission", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder.ID, dashboards.DashboardACL{
						DashboardID: folder.ID, OrgID: 1, UserID: currentUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to access folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
							OrgId:        1,
							DashboardIds: []int64{folder.ID, dashInRoot.ID},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 2)
						require.Equal(t, query.Result[0].ID, folder.ID)
						require.Equal(t, query.Result[1].ID, dashInRoot.ID)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to access folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{
								UserID:  currentUser.ID,
								OrgID:   1,
								OrgRole: org.RoleAdmin,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.ID, dashInRoot.ID},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 2)
						require.Equal(t, query.Result[0].ID, folder.ID)
						require.Equal(t, query.Result[1].ID, dashInRoot.ID)
					})
				})
			})

			t.Run("and acl is set for dashboard child and folder has all permissions removed", func(t *testing.T) {
				var otherUser int64 = 999
				err := updateDashboardACL(t, dashboardStore, folder.ID)
				require.NoError(t, err)
				err = updateDashboardACL(t, dashboardStore, childDash.ID, dashboards.DashboardACL{
					DashboardID: folder.ID, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder or child", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer}, OrgId: 1, DashboardIds: []int64{folder.ID, childDash.ID, dashInRoot.ID},
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, dashInRoot.ID)
				})

				t.Run("when the user is given permission to child", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, childDash.ID, dashboards.DashboardACL{
						DashboardID: childDash.ID, OrgID: 1, UserID: currentUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to search for child dashboard but not folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer}, OrgId: 1, DashboardIds: []int64{folder.ID, childDash.ID, dashInRoot.ID}}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 2)
						require.Equal(t, query.Result[0].ID, childDash.ID)
						require.Equal(t, query.Result[1].ID, dashInRoot.ID)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to search for child dash and folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{
								UserID:  currentUser.ID,
								OrgID:   1,
								OrgRole: org.RoleAdmin,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.ID, dashInRoot.ID, childDash.ID},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 3)
						require.Equal(t, query.Result[0].ID, folder.ID)
						require.Equal(t, query.Result[1].ID, childDash.ID)
						require.Equal(t, query.Result[2].ID, dashInRoot.ID)
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
					query := &models.FindPersistedDashboardsQuery{
						FolderIds: []int64{
							rootFolderId, folder1.ID}, SignedInUser: &user.SignedInUser{UserID: currentUser.ID,
							OrgID: 1, OrgRole: org.RoleViewer,
						},
						OrgId: 1,
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(query.Result), 4)
					require.Equal(t, query.Result[0].ID, folder1.ID)
					require.Equal(t, query.Result[1].ID, folder2.ID)
					require.Equal(t, query.Result[2].ID, childDash1.ID)
					require.Equal(t, query.Result[3].ID, dashInRoot.ID)
				})
			})

			t.Run("and acl is set for one dashboard folder", func(t *testing.T) {
				const otherUser int64 = 999
				err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
					DashboardID: folder1.ID, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("and a dashboard is moved from folder without acl to the folder with an acl", func(t *testing.T) {
					moveDashboard(t, dashboardStore, 1, childDash2.Data, folder1.ID)

					t.Run("should not return folder with acl or its children", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
							OrgId:        1,
							DashboardIds: []int64{folder1.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 1)
						require.Equal(t, query.Result[0].ID, dashInRoot.ID)
					})
				})
				t.Run("and a dashboard is moved from folder with acl to the folder without an acl", func(t *testing.T) {
					setup2()
					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.ID)

					t.Run("should return folder without acl and its children", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
							OrgId:        1,
							DashboardIds: []int64{folder2.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 4)
						require.Equal(t, query.Result[0].ID, folder2.ID)
						require.Equal(t, query.Result[1].ID, childDash1.ID)
						require.Equal(t, query.Result[2].ID, childDash2.ID)
						require.Equal(t, query.Result[3].ID, dashInRoot.ID)
					})
				})

				t.Run("and a dashboard with an acl is moved to the folder without an acl", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, childDash1.ID, dashboards.DashboardACL{
						DashboardID: childDash1.ID, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.ID)

					t.Run("should return folder without acl but not the dashboard with acl", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &user.SignedInUser{UserID: currentUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
							OrgId:        1,
							DashboardIds: []int64{folder2.ID, childDash1.ID, childDash2.ID, dashInRoot.ID},
						}
						err = testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 4)
						require.Equal(t, query.Result[0].ID, folder2.ID)
						require.Equal(t, query.Result[1].ID, childDash1.ID)
						require.Equal(t, query.Result[2].ID, childDash2.ID)
						require.Equal(t, query.Result[3].ID, dashInRoot.ID)
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
					query := models.FindPersistedDashboardsQuery{
						OrgId:        1,
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgRole: org.RoleAdmin, OrgID: 1},
						Permission:   models.PERMISSION_VIEW,
						Type:         "dash-folder",
					}

					err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].ID, folder1.ID)
					require.Equal(t, query.Result[1].ID, folder2.ID)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleAdmin},
					}
					err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})

				t.Run("should have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInDashboardsOrFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleAdmin},
					}
					err := dashboardStore.HasAdminPermissionInDashboardsOrFolders(context.Background(), query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})
			})

			t.Run("Editor users", func(t *testing.T) {
				query := models.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &user.SignedInUser{UserID: editorUser.ID, OrgRole: org.RoleEditor, OrgID: 1},
					Permission:   models.PERMISSION_EDIT,
				}

				t.Run("Should have write access to all dashboard folders with default ACL", func(t *testing.T) {
					err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].ID, folder1.ID)
					require.Equal(t, query.Result[1].ID, folder2.ID)
				})

				t.Run("Should have write access to one dashboard folder if default role changed to view for one folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: editorUser.ID, Permission: models.PERMISSION_VIEW,
					})
					require.NoError(t, err)

					err = testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, folder2.ID)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: editorUser.ID, OrgID: 1, OrgRole: org.RoleEditor},
					}
					err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					go require.NoError(t, err)
					require.True(t, query.Result)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInDashboardsOrFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleEditor},
					}
					err := dashboardStore.HasAdminPermissionInDashboardsOrFolders(context.Background(), query)
					require.NoError(t, err)
					require.False(t, query.Result)
				})
			})

			t.Run("Viewer users", func(t *testing.T) {
				query := models.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgRole: org.RoleViewer, OrgID: 1},
					Permission:   models.PERMISSION_EDIT,
				}

				t.Run("Should have no write access to any dashboard folders with default ACL", func(t *testing.T) {
					err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 0)
				})

				t.Run("Should be able to get one dashboard folder if default role changed to edit for one folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: viewerUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					err = testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, folder1.ID)
				})

				t.Run("should not have edit permission in folders", func(t *testing.T) {
					setup3()

					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
					}
					err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					go require.NoError(t, err)
					require.False(t, query.Result)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInDashboardsOrFoldersQuery{
						SignedInUser: &user.SignedInUser{UserID: adminUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
					}
					err := dashboardStore.HasAdminPermissionInDashboardsOrFolders(context.Background(), query)
					require.NoError(t, err)
					require.False(t, query.Result)
				})

				t.Run("and admin permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: viewerUser.ID, Permission: models.PERMISSION_ADMIN,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &models.HasEditPermissionInFoldersQuery{
							SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						}
						err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
						go require.NoError(t, err)
						require.True(t, query.Result)
					})
				})

				t.Run("and edit permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := updateDashboardACL(t, dashboardStore, folder1.ID, dashboards.DashboardACL{
						DashboardID: folder1.ID, OrgID: 1, UserID: viewerUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &models.HasEditPermissionInFoldersQuery{
							SignedInUser: &user.SignedInUser{UserID: viewerUser.ID, OrgID: 1, OrgRole: org.RoleViewer},
						}
						err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
						go require.NoError(t, err)
						require.True(t, query.Result)
					})
				})
			})
		})

		t.Run("Given dashboard and folder with the same title", func(t *testing.T) {
			var orgId int64 = 1
			title := "Very Unique Name"
			var sqlStore *sqlstore.SQLStore
			var folder1, folder2 *dashboards.Dashboard
			sqlStore = db.InitTestDB(t)
			quotaService := quotatest.New(false, nil)
			dashboardStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
			require.NoError(t, err)
			folder2 = insertTestDashboard(t, dashboardStore, "TEST", orgId, 0, true, "prod")
			_ = insertTestDashboard(t, dashboardStore, title, orgId, folder2.ID, false, "prod")
			folder1 = insertTestDashboard(t, dashboardStore, title, orgId, 0, true, "prod")

			t.Run("GetFolderByTitle should find the folder", func(t *testing.T) {
				result, err := dashboardStore.GetFolderByTitle(context.Background(), orgId, title)
				require.NoError(t, err)
				require.Equal(t, folder1.ID, result.ID)
			})
		})

		t.Run("GetFolderByUID", func(t *testing.T) {
			var orgId int64 = 1
			sqlStore := db.InitTestDB(t)
			quotaService := quotatest.New(false, nil)
			dashboardStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
			require.NoError(t, err)
			folder := insertTestDashboard(t, dashboardStore, "TEST", orgId, 0, true, "prod")
			dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.ID, false, "prod")

			t.Run("should return folder by UID", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByUID(context.Background(), orgId, folder.UID)
				require.Equal(t, folder.ID, d.ID)
				require.NoError(t, err)
			})
			t.Run("should not find dashboard", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByUID(context.Background(), orgId, dash.UID)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
			t.Run("should search in organization", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByUID(context.Background(), orgId+1, folder.UID)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
		})

		t.Run("GetFolderByID", func(t *testing.T) {
			var orgId int64 = 1
			sqlStore := db.InitTestDB(t)
			quotaService := quotatest.New(false, nil)
			dashboardStore, err := ProvideDashboardStore(sqlStore, sqlStore.Cfg, testFeatureToggles, tagimpl.ProvideService(sqlStore, sqlStore.Cfg), quotaService)
			require.NoError(t, err)
			folder := insertTestDashboard(t, dashboardStore, "TEST", orgId, 0, true, "prod")
			dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.ID, false, "prod")

			t.Run("should return folder by ID", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByID(context.Background(), orgId, folder.ID)
				require.Equal(t, folder.ID, d.ID)
				require.NoError(t, err)
			})
			t.Run("should not find dashboard", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByID(context.Background(), orgId, dash.ID)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
			t.Run("should search in organization", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByID(context.Background(), orgId+1, folder.ID)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
		})
	})
}

func moveDashboard(t *testing.T, dashboardStore *DashboardStore, orgId int64, dashboard *simplejson.Json,
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
