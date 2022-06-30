package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestIntegrationDashboardFolderDataAccess(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	t.Run("Testing DB", func(t *testing.T) {
		var sqlStore *sqlstore.SQLStore
		var folder, dashInRoot, childDash *models.Dashboard
		var currentUser user.User
		var dashboardStore *DashboardStore

		setup := func() {
			sqlStore = sqlstore.InitTestDB(t)
			sqlStore.Cfg.RBACEnabled = false
			dashboardStore = ProvideDashboardStore(sqlStore)
			folder = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod", "webapp")
			childDash = insertTestDashboard(t, dashboardStore, "test dash 23", 1, folder.Id, false, "prod", "webapp")
			insertTestDashboard(t, dashboardStore, "test dash 45", 1, folder.Id, false, "prod")
			currentUser = CreateUser(t, sqlStore, "viewer", "Viewer", false)
		}

		t.Run("Given one dashboard folder with two dashboards and one dashboard in the root folder", func(t *testing.T) {
			setup()

			t.Run("and no acls are set", func(t *testing.T) {
				t.Run("should return all dashboards", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						OrgId:        1,
						DashboardIds: []int64{folder.Id, dashInRoot.Id},
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].ID, folder.Id)
					require.Equal(t, query.Result[1].ID, dashInRoot.Id)
				})
			})

			t.Run("and acl is set for dashboard folder", func(t *testing.T) {
				var otherUser int64 = 999
				err := updateDashboardAcl(t, dashboardStore, folder.Id, models.DashboardAcl{
					DashboardID: folder.Id,
					OrgID:       1,
					UserID:      otherUser,
					Permission:  models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						OrgId:        1, DashboardIds: []int64{folder.Id, dashInRoot.Id},
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, dashInRoot.Id)
				})

				t.Run("when the user is given permission", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, folder.Id, models.DashboardAcl{
						DashboardID: folder.Id, OrgID: 1, UserID: currentUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to access folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 2)
						require.Equal(t, query.Result[0].ID, folder.Id)
						require.Equal(t, query.Result[1].ID, dashInRoot.Id)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to access folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{
								UserId:  currentUser.ID,
								OrgId:   1,
								OrgRole: models.ROLE_ADMIN,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 2)
						require.Equal(t, query.Result[0].ID, folder.Id)
						require.Equal(t, query.Result[1].ID, dashInRoot.Id)
					})
				})
			})

			t.Run("and acl is set for dashboard child and folder has all permissions removed", func(t *testing.T) {
				var otherUser int64 = 999
				err := updateDashboardAcl(t, dashboardStore, folder.Id)
				require.NoError(t, err)
				err = updateDashboardAcl(t, dashboardStore, childDash.Id, models.DashboardAcl{
					DashboardID: folder.Id, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder or child", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id},
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, dashInRoot.Id)
				})

				t.Run("when the user is given permission to child", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, childDash.Id, models.DashboardAcl{
						DashboardID: childDash.Id, OrgID: 1, UserID: currentUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to search for child dashboard but not folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id}}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 2)
						require.Equal(t, query.Result[0].ID, childDash.Id)
						require.Equal(t, query.Result[1].ID, dashInRoot.Id)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to search for child dash and folder", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{
								UserId:  currentUser.ID,
								OrgId:   1,
								OrgRole: models.ROLE_ADMIN,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id, childDash.Id},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 3)
						require.Equal(t, query.Result[0].ID, folder.Id)
						require.Equal(t, query.Result[1].ID, childDash.Id)
						require.Equal(t, query.Result[2].ID, dashInRoot.Id)
					})
				})
			})
		})

		t.Run("Given two dashboard folders with one dashboard each and one dashboard in the root folder", func(t *testing.T) {
			var sqlStore *sqlstore.SQLStore
			var folder1, folder2, dashInRoot, childDash1, childDash2 *models.Dashboard
			var currentUser user.User
			var rootFolderId int64 = 0

			setup2 := func() {
				sqlStore = sqlstore.InitTestDB(t)
				dashboardStore := ProvideDashboardStore(sqlStore)
				folder1 = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod")
				folder2 = insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, true, "prod")
				dashInRoot = insertTestDashboard(t, dashboardStore, "test dash 67", 1, 0, false, "prod")
				childDash1 = insertTestDashboard(t, dashboardStore, "child dash 1", 1, folder1.Id, false, "prod")
				childDash2 = insertTestDashboard(t, dashboardStore, "child dash 2", 1, folder2.Id, false, "prod")

				currentUser = CreateUser(t, sqlStore, "viewer", "Viewer", false)
			}

			setup2()
			t.Run("and one folder is expanded, the other collapsed", func(t *testing.T) {
				t.Run("should return dashboards in root and expanded folder", func(t *testing.T) {
					query := &models.FindPersistedDashboardsQuery{
						FolderIds: []int64{
							rootFolderId, folder1.Id}, SignedInUser: &models.SignedInUser{UserId: currentUser.ID,
							OrgId: 1, OrgRole: models.ROLE_VIEWER,
						},
						OrgId: 1,
					}
					err := testSearchDashboards(dashboardStore, query)
					require.NoError(t, err)
					require.Equal(t, len(query.Result), 4)
					require.Equal(t, query.Result[0].ID, folder1.Id)
					require.Equal(t, query.Result[1].ID, folder2.Id)
					require.Equal(t, query.Result[2].ID, childDash1.Id)
					require.Equal(t, query.Result[3].ID, dashInRoot.Id)
				})
			})

			t.Run("and acl is set for one dashboard folder", func(t *testing.T) {
				const otherUser int64 = 999
				err := updateDashboardAcl(t, dashboardStore, folder1.Id, models.DashboardAcl{
					DashboardID: folder1.Id, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("and a dashboard is moved from folder without acl to the folder with an acl", func(t *testing.T) {
					moveDashboard(t, dashboardStore, 1, childDash2.Data, folder1.Id)

					t.Run("should not return folder with acl or its children", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder1.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 1)
						require.Equal(t, query.Result[0].ID, dashInRoot.Id)
					})
				})
				t.Run("and a dashboard is moved from folder with acl to the folder without an acl", func(t *testing.T) {
					setup2()
					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.Id)

					t.Run("should return folder without acl and its children", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 4)
						require.Equal(t, query.Result[0].ID, folder2.Id)
						require.Equal(t, query.Result[1].ID, childDash1.Id)
						require.Equal(t, query.Result[2].ID, childDash2.Id)
						require.Equal(t, query.Result[3].ID, dashInRoot.Id)
					})
				})

				t.Run("and a dashboard with an acl is moved to the folder without an acl", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, childDash1.Id, models.DashboardAcl{
						DashboardID: childDash1.Id, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					moveDashboard(t, dashboardStore, 1, childDash1.Data, folder2.Id)

					t.Run("should return folder without acl but not the dashboard with acl", func(t *testing.T) {
						query := &models.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err = testSearchDashboards(dashboardStore, query)
						require.NoError(t, err)
						require.Equal(t, len(query.Result), 4)
						require.Equal(t, query.Result[0].ID, folder2.Id)
						require.Equal(t, query.Result[1].ID, childDash1.Id)
						require.Equal(t, query.Result[2].ID, childDash2.Id)
						require.Equal(t, query.Result[3].ID, dashInRoot.Id)
					})
				})
			})
		})

		t.Run("Given two dashboard folders", func(t *testing.T) {
			var sqlStore *sqlstore.SQLStore
			var folder1, folder2 *models.Dashboard
			var adminUser, editorUser, viewerUser user.User

			setup3 := func() {
				sqlStore = sqlstore.InitTestDB(t)
				dashboardStore := ProvideDashboardStore(sqlStore)
				folder1 = insertTestDashboard(t, dashboardStore, "1 test dash folder", 1, 0, true, "prod")
				folder2 = insertTestDashboard(t, dashboardStore, "2 test dash folder", 1, 0, true, "prod")
				insertTestDashboard(t, dashboardStore, "folder in another org", 2, 0, true, "prod")

				adminUser = CreateUser(t, sqlStore, "admin", "Admin", true)
				editorUser = CreateUser(t, sqlStore, "editor", "Editor", false)
				viewerUser = CreateUser(t, sqlStore, "viewer", "Viewer", false)
			}

			setup3()
			t.Run("Admin users", func(t *testing.T) {
				t.Run("Should have write access to all dashboard folders in their org", func(t *testing.T) {
					query := models.FindPersistedDashboardsQuery{
						OrgId:        1,
						SignedInUser: &models.SignedInUser{UserId: adminUser.ID, OrgRole: models.ROLE_ADMIN, OrgId: 1},
						Permission:   models.PERMISSION_VIEW,
						Type:         "dash-folder",
					}

					err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].ID, folder1.Id)
					require.Equal(t, query.Result[1].ID, folder2.Id)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.ID, OrgId: 1, OrgRole: models.ROLE_ADMIN},
					}
					err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})

				t.Run("should have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.ID, OrgId: 1, OrgRole: models.ROLE_ADMIN},
					}
					err := dashboardStore.HasAdminPermissionInFolders(context.Background(), query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})
			})

			t.Run("Editor users", func(t *testing.T) {
				query := models.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &models.SignedInUser{UserId: editorUser.ID, OrgRole: models.ROLE_EDITOR, OrgId: 1},
					Permission:   models.PERMISSION_EDIT,
				}

				t.Run("Should have write access to all dashboard folders with default ACL", func(t *testing.T) {
					err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 2)
					require.Equal(t, query.Result[0].ID, folder1.Id)
					require.Equal(t, query.Result[1].ID, folder2.Id)
				})

				t.Run("Should have write access to one dashboard folder if default role changed to view for one folder", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: editorUser.ID, Permission: models.PERMISSION_VIEW,
					})
					require.NoError(t, err)

					err = testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, folder2.Id)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: editorUser.ID, OrgId: 1, OrgRole: models.ROLE_EDITOR},
					}
					err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					go require.NoError(t, err)
					require.True(t, query.Result)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.ID, OrgId: 1, OrgRole: models.ROLE_EDITOR},
					}
					err := dashboardStore.HasAdminPermissionInFolders(context.Background(), query)
					require.NoError(t, err)
					require.False(t, query.Result)
				})
			})

			t.Run("Viewer users", func(t *testing.T) {
				query := models.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &models.SignedInUser{UserId: viewerUser.ID, OrgRole: models.ROLE_VIEWER, OrgId: 1},
					Permission:   models.PERMISSION_EDIT,
				}

				t.Run("Should have no write access to any dashboard folders with default ACL", func(t *testing.T) {
					err := testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 0)
				})

				t.Run("Should be able to get one dashboard folder if default role changed to edit for one folder", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: viewerUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					err = testSearchDashboards(dashboardStore, &query)
					require.NoError(t, err)

					require.Equal(t, len(query.Result), 1)
					require.Equal(t, query.Result[0].ID, folder1.Id)
				})

				t.Run("should not have edit permission in folders", func(t *testing.T) {
					setup3()

					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: viewerUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
					}
					err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
					go require.NoError(t, err)
					require.False(t, query.Result)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
					}
					err := dashboardStore.HasAdminPermissionInFolders(context.Background(), query)
					require.NoError(t, err)
					require.False(t, query.Result)
				})

				t.Run("and admin permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: viewerUser.ID, Permission: models.PERMISSION_ADMIN,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &models.HasEditPermissionInFoldersQuery{
							SignedInUser: &models.SignedInUser{UserId: viewerUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						}
						err := dashboardStore.HasEditPermissionInFolders(context.Background(), query)
						go require.NoError(t, err)
						require.True(t, query.Result)
					})
				})

				t.Run("and edit permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := updateDashboardAcl(t, dashboardStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: viewerUser.ID, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &models.HasEditPermissionInFoldersQuery{
							SignedInUser: &models.SignedInUser{UserId: viewerUser.ID, OrgId: 1, OrgRole: models.ROLE_VIEWER},
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
			var folder1, folder2 *models.Dashboard
			sqlStore = sqlstore.InitTestDB(t)
			dashboardStore := ProvideDashboardStore(sqlStore)
			folder2 = insertTestDashboard(t, dashboardStore, "TEST", orgId, 0, true, "prod")
			_ = insertTestDashboard(t, dashboardStore, title, orgId, folder2.Id, false, "prod")
			folder1 = insertTestDashboard(t, dashboardStore, title, orgId, 0, true, "prod")

			t.Run("GetFolderByTitle should find the folder", func(t *testing.T) {
				result, err := dashboardStore.GetFolderByTitle(context.Background(), orgId, title)
				require.NoError(t, err)
				require.Equal(t, folder1.Id, result.Id)
			})
		})

		t.Run("GetFolderByUID", func(t *testing.T) {
			var orgId int64 = 1
			sqlStore := sqlstore.InitTestDB(t)
			dashboardStore := ProvideDashboardStore(sqlStore)
			folder := insertTestDashboard(t, dashboardStore, "TEST", orgId, 0, true, "prod")
			dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.Id, false, "prod")

			t.Run("should return folder by UID", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByUID(context.Background(), orgId, folder.Uid)
				require.Equal(t, folder.Id, d.Id)
				require.NoError(t, err)
			})
			t.Run("should not find dashboard", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByUID(context.Background(), orgId, dash.Uid)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
			t.Run("should search in organization", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByUID(context.Background(), orgId+1, folder.Uid)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
		})

		t.Run("GetFolderByID", func(t *testing.T) {
			var orgId int64 = 1
			sqlStore := sqlstore.InitTestDB(t)
			dashboardStore := ProvideDashboardStore(sqlStore)
			folder := insertTestDashboard(t, dashboardStore, "TEST", orgId, 0, true, "prod")
			dash := insertTestDashboard(t, dashboardStore, "Very Unique Name", orgId, folder.Id, false, "prod")

			t.Run("should return folder by ID", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByID(context.Background(), orgId, folder.Id)
				require.Equal(t, folder.Id, d.Id)
				require.NoError(t, err)
			})
			t.Run("should not find dashboard", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByID(context.Background(), orgId, dash.Id)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
			t.Run("should search in organization", func(t *testing.T) {
				d, err := dashboardStore.GetFolderByID(context.Background(), orgId+1, folder.Id)
				require.Nil(t, d)
				require.ErrorIs(t, err, dashboards.ErrFolderNotFound)
			})
		})
	})
}

func moveDashboard(t *testing.T, dashboardStore *DashboardStore, orgId int64, dashboard *simplejson.Json,
	newFolderId int64) *models.Dashboard {
	t.Helper()

	cmd := models.SaveDashboardCommand{
		OrgId:     orgId,
		FolderId:  newFolderId,
		Dashboard: dashboard,
		Overwrite: true,
	}
	dash, err := dashboardStore.SaveDashboard(cmd)
	require.NoError(t, err)

	return dash
}
