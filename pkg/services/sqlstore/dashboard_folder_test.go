// +build integration

package sqlstore

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func TestDashboardFolderDataAccess(t *testing.T) {
	t.Run("Testing DB", func(t *testing.T) {
		sqlStore := InitTestDB(t)

		t.Run("Given one dashboard folder with two dashboards and one dashboard in the root folder", func(t *testing.T) {
			folder := insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot := insertTestDashboard(t, sqlStore, "test dash 67", 1, 0, false, "prod", "webapp")
			childDash := insertTestDashboard(t, sqlStore, "test dash 23", 1, folder.Id, false, "prod", "webapp")
			insertTestDashboard(t, sqlStore, "test dash 45", 1, folder.Id, false, "prod")

			currentUser := createUser(t, sqlStore, "viewer", "Viewer", false)

			t.Run("and no acls are set", func(t *testing.T) {
				t.Run("should return all dashboards", func(t *testing.T) {
					query := &search.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						OrgId:        1,
						DashboardIds: []int64{folder.Id, dashInRoot.Id},
					}
					err := SearchDashboards(query)
					require.NoError(t, err)
					require.Equal(t, 2, len(query.Result))
					require.Equal(t, folder.Id, query.Result[0].ID)
					require.Equal(t, dashInRoot.Id, query.Result[1].ID)
				})
			})

			t.Run("and acl is set for dashboard folder", func(t *testing.T) {
				var otherUser int64 = 999
				err := testHelperUpdateDashboardAcl(t, sqlStore, folder.Id, models.DashboardAcl{
					DashboardID: folder.Id,
					OrgID:       1,
					UserID:      otherUser,
					Permission:  models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder", func(t *testing.T) {
					query := &search.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						OrgId:        1, DashboardIds: []int64{folder.Id, dashInRoot.Id},
					}
					err := SearchDashboards(query)
					require.NoError(t, err)

					require.Equal(t, 1, len(query.Result))
					require.Equal(t, dashInRoot.Id, query.Result[0].ID)
				})

				t.Run("when the user is given permission", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, folder.Id, models.DashboardAcl{
						DashboardID: folder.Id, OrgID: 1, UserID: currentUser.Id, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to access folder", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 2, len(query.Result))
						require.Equal(t, folder.Id, query.Result[0].ID)
						require.Equal(t, dashInRoot.Id, query.Result[1].ID)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to access folder", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{
								UserId:  currentUser.Id,
								OrgId:   1,
								OrgRole: models.ROLE_ADMIN,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 2, len(query.Result))
						require.Equal(t, folder.Id, query.Result[0].ID)
						require.Equal(t, dashInRoot.Id, query.Result[1].ID)
					})
				})
			})

			t.Run("and acl is set for dashboard child and folder has all permissions removed", func(t *testing.T) {
				var otherUser int64 = 999
				err := testHelperUpdateDashboardAcl(t, sqlStore, folder.Id)
				require.NoError(t, err)
				err = testHelperUpdateDashboardAcl(t, sqlStore, childDash.Id, models.DashboardAcl{
					DashboardID: folder.Id, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("should not return folder or child", func(t *testing.T) {
					query := &search.FindPersistedDashboardsQuery{
						SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id},
					}
					err := SearchDashboards(query)
					require.NoError(t, err)
					require.Equal(t, 1, len(query.Result))
					require.Equal(t, dashInRoot.Id, query.Result[0].ID)
				})

				t.Run("when the user is given permission to child", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, childDash.Id, models.DashboardAcl{
						DashboardID: childDash.Id, OrgID: 1, UserID: currentUser.Id, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should be able to search for child dashboard but not folder", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id}}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 2, len(query.Result))
						require.Equal(t, childDash.Id, query.Result[0].ID)
						require.Equal(t, dashInRoot.Id, query.Result[1].ID)
					})
				})

				t.Run("when the user is an admin", func(t *testing.T) {
					t.Run("should be able to search for child dash and folder", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{
								UserId:  currentUser.Id,
								OrgId:   1,
								OrgRole: models.ROLE_ADMIN,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id, childDash.Id},
						}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 3, len(query.Result))
						require.Equal(t, folder.Id, query.Result[0].ID)
						require.Equal(t, childDash.Id, query.Result[1].ID)
						require.Equal(t, dashInRoot.Id, query.Result[2].ID)
					})
				})
			})
		})

		t.Run("Given two dashboard folders with one dashboard each and one dashboard in the root folder", func(t *testing.T) {
			folder1 := insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod")
			folder2 := insertTestDashboard(t, sqlStore, "2 test dash folder", 1, 0, true, "prod")
			dashInRoot := insertTestDashboard(t, sqlStore, "test dash 67", 1, 0, false, "prod")
			childDash1 := insertTestDashboard(t, sqlStore, "child dash 1", 1, folder1.Id, false, "prod")
			childDash2 := insertTestDashboard(t, sqlStore, "child dash 2", 1, folder2.Id, false, "prod")

			currentUser := createUser(t, sqlStore, "viewer", "Viewer", false)
			var rootFolderId int64 = 0

			t.Run("and one folder is expanded, the other collapsed", func(t *testing.T) {
				t.Run("should return dashboards in root and expanded folder", func(t *testing.T) {
					query := &search.FindPersistedDashboardsQuery{
						FolderIds: []int64{
							rootFolderId, folder1.Id}, SignedInUser: &models.SignedInUser{UserId: currentUser.Id,
							OrgId: 1, OrgRole: models.ROLE_VIEWER,
						},
						OrgId: 1,
					}
					err := SearchDashboards(query)
					require.NoError(t, err)
					require.Equal(t, 4, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].ID)
					require.Equal(t, folder2.Id, query.Result[1].ID)
					require.Equal(t, childDash1.Id, query.Result[2].ID)
					require.Equal(t, dashInRoot.Id, query.Result[3].ID)
				})
			})

			t.Run("and acl is set for one dashboard folder", func(t *testing.T) {
				const otherUser int64 = 999
				err := testHelperUpdateDashboardAcl(t, sqlStore, folder1.Id, models.DashboardAcl{
					DashboardID: folder1.Id, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
				})
				require.NoError(t, err)

				t.Run("and a dashboard is moved from folder without acl to the folder with an acl", func(t *testing.T) {
					moveDashboard(t, sqlStore, 1, childDash2.Data, folder1.Id)

					t.Run("should not return folder with acl or its children", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder1.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 1, len(query.Result))
						require.Equal(t, dashInRoot.Id, query.Result[0].ID)
					})
				})
				t.Run("and a dashboard is moved from folder with acl to the folder without an acl", func(t *testing.T) {
					moveDashboard(t, sqlStore, 1, childDash1.Data, folder2.Id)

					t.Run("should return folder without acl and its children", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 4, len(query.Result))
						require.Equal(t, folder2.Id, query.Result[0].ID)
						require.Equal(t, childDash1.Id, query.Result[1].ID)
						require.Equal(t, childDash2.Id, query.Result[2].ID)
						require.Equal(t, dashInRoot.Id, query.Result[3].ID)
					})
				})

				t.Run("and a dashboard with an acl is moved to the folder without an acl", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, childDash1.Id, models.DashboardAcl{
						DashboardID: childDash1.Id, OrgID: 1, UserID: otherUser, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					moveDashboard(t, sqlStore, 1, childDash1.Data, folder2.Id)

					t.Run("should return folder without acl but not the dashboard with acl", func(t *testing.T) {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &models.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						require.NoError(t, err)
						require.Equal(t, 4, len(query.Result))
						require.Equal(t, folder2.Id, query.Result[0].ID)
						require.Equal(t, childDash1.Id, query.Result[1].ID)
						require.Equal(t, childDash2.Id, query.Result[2].ID)
						require.Equal(t, dashInRoot.Id, query.Result[3].ID)
					})
				})
			})
		})

		t.Run("Given two dashboard folders", func(t *testing.T) {
			folder1 := insertTestDashboard(t, sqlStore, "1 test dash folder", 1, 0, true, "prod")
			folder2 := insertTestDashboard(t, sqlStore, "2 test dash folder", 1, 0, true, "prod")
			insertTestDashboard(t, sqlStore, "folder in another org", 2, 0, true, "prod")

			adminUser := createUser(t, sqlStore, "admin", "Admin", true)
			editorUser := createUser(t, sqlStore, "editor", "Editor", false)
			viewerUser := createUser(t, sqlStore, "viewer", "Viewer", false)

			t.Run("Admin users", func(t *testing.T) {
				t.Run("Should have write access to all dashboard folders in their org", func(t *testing.T) {
					query := search.FindPersistedDashboardsQuery{
						OrgId:        1,
						SignedInUser: &models.SignedInUser{UserId: adminUser.Id, OrgRole: models.ROLE_ADMIN, OrgId: 1},
						Permission:   models.PERMISSION_VIEW,
						Type:         "dash-folder",
					}

					err := SearchDashboards(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].ID)
					require.Equal(t, folder2.Id, query.Result[1].ID)
				})

				t.Run("should have write access to all folders and dashboards", func(t *testing.T) {
					query := models.GetDashboardPermissionsForUserQuery{
						DashboardIds: []int64{folder1.Id, folder2.Id},
						OrgId:        1,
						UserId:       adminUser.Id,
						OrgRole:      models.ROLE_ADMIN,
					}

					err := GetDashboardPermissionsForUser(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].DashboardId)
					require.Equal(t, models.PERMISSION_ADMIN, query.Result[0].Permission)
					require.Equal(t, folder2.Id, query.Result[1].DashboardId)
					require.Equal(t, models.PERMISSION_ADMIN, query.Result[1].Permission)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.Id, OrgId: 1, OrgRole: models.ROLE_ADMIN},
					}
					err := HasEditPermissionInFolders(query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})

				t.Run("should have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.Id, OrgId: 1, OrgRole: models.ROLE_ADMIN},
					}
					err := HasAdminPermissionInFolders(query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})
			})

			t.Run("Editor users", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &models.SignedInUser{UserId: editorUser.Id, OrgRole: models.ROLE_EDITOR, OrgId: 1},
					Permission:   models.PERMISSION_EDIT,
				}

				t.Run("Should have write access to all dashboard folders with default ACL", func(t *testing.T) {
					err := SearchDashboards(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].ID)
					require.Equal(t, folder2.Id, query.Result[1].ID)
				})

				t.Run("should have edit access to folders with default ACL", func(t *testing.T) {
					query := models.GetDashboardPermissionsForUserQuery{
						DashboardIds: []int64{folder1.Id, folder2.Id},
						OrgId:        1,
						UserId:       editorUser.Id,
						OrgRole:      models.ROLE_EDITOR,
					}

					err := GetDashboardPermissionsForUser(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].DashboardId)
					require.Equal(t, models.PERMISSION_EDIT, query.Result[0].Permission)
					require.Equal(t, folder2.Id, query.Result[1].DashboardId)
					require.Equal(t, models.PERMISSION_EDIT, query.Result[1].Permission)
				})

				t.Run("Should have write access to one dashboard folder if default role changed to view for one folder", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: editorUser.Id, Permission: models.PERMISSION_VIEW,
					})
					require.NoError(t, err)

					err = SearchDashboards(&query)
					require.NoError(t, err)

					require.Equal(t, 1, len(query.Result))
					require.Equal(t, folder2.Id, query.Result[0].ID)
				})

				t.Run("should have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: editorUser.Id, OrgId: 1, OrgRole: models.ROLE_EDITOR},
					}
					err := HasEditPermissionInFolders(query)
					require.NoError(t, err)
					require.True(t, query.Result)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.Id, OrgId: 1, OrgRole: models.ROLE_EDITOR},
					}
					err := HasAdminPermissionInFolders(query)
					require.NoError(t, err)
					So(query.Result, ShouldBeFalse)
				})
			})

			t.Run("Viewer users", func(t *testing.T) {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &models.SignedInUser{UserId: viewerUser.Id, OrgRole: models.ROLE_VIEWER, OrgId: 1},
					Permission:   models.PERMISSION_EDIT,
				}

				t.Run("Should have no write access to any dashboard folders with default ACL", func(t *testing.T) {
					err := SearchDashboards(&query)
					require.NoError(t, err)

					require.Equal(t, 0, len(query.Result))
				})

				t.Run("should have view access to folders with default ACL", func(t *testing.T) {
					query := models.GetDashboardPermissionsForUserQuery{
						DashboardIds: []int64{folder1.Id, folder2.Id},
						OrgId:        1,
						UserId:       viewerUser.Id,
						OrgRole:      models.ROLE_VIEWER,
					}

					err := GetDashboardPermissionsForUser(&query)
					require.NoError(t, err)

					require.Equal(t, 2, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].DashboardId)
					require.Equal(t, models.PERMISSION_VIEW, query.Result[0].Permission)
					require.Equal(t, folder2.Id, query.Result[1].DashboardId)
					require.Equal(t, models.PERMISSION_VIEW, query.Result[1].Permission)
				})

				t.Run("Should be able to get one dashboard folder if default role changed to edit for one folder", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: viewerUser.Id, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					err = SearchDashboards(&query)
					require.NoError(t, err)

					require.Equal(t, 1, len(query.Result))
					require.Equal(t, folder1.Id, query.Result[0].ID)
				})

				t.Run("should not have edit permission in folders", func(t *testing.T) {
					query := &models.HasEditPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: viewerUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
					}
					err := HasEditPermissionInFolders(query)
					require.NoError(t, err)
					So(query.Result, ShouldBeFalse)
				})

				t.Run("should not have admin permission in folders", func(t *testing.T) {
					query := &models.HasAdminPermissionInFoldersQuery{
						SignedInUser: &models.SignedInUser{UserId: adminUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
					}
					err := HasAdminPermissionInFolders(query)
					require.NoError(t, err)
					So(query.Result, ShouldBeFalse)
				})

				t.Run("and admin permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: viewerUser.Id, Permission: models.PERMISSION_ADMIN,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &models.HasEditPermissionInFoldersQuery{
							SignedInUser: &models.SignedInUser{UserId: viewerUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						}
						err := HasEditPermissionInFolders(query)
						require.NoError(t, err)
						require.True(t, query.Result)
					})
				})

				t.Run("and edit permission is given for user with org role viewer in one dashboard folder", func(t *testing.T) {
					err := testHelperUpdateDashboardAcl(t, sqlStore, folder1.Id, models.DashboardAcl{
						DashboardID: folder1.Id, OrgID: 1, UserID: viewerUser.Id, Permission: models.PERMISSION_EDIT,
					})
					require.NoError(t, err)

					t.Run("should have edit permission in folders", func(t *testing.T) {
						query := &models.HasEditPermissionInFoldersQuery{
							SignedInUser: &models.SignedInUser{UserId: viewerUser.Id, OrgId: 1, OrgRole: models.ROLE_VIEWER},
						}
						err := HasEditPermissionInFolders(query)
						require.NoError(t, err)
						require.True(t, query.Result)
					})
				})
			})
		})
	})
}

func moveDashboard(t *testing.T, sqlStore *SQLStore, orgId int64, dashboard *simplejson.Json,
	newFolderId int64) *models.Dashboard {
	t.Helper()

	cmd := models.SaveDashboardCommand{
		OrgId:     orgId,
		FolderId:  newFolderId,
		Dashboard: dashboard,
		Overwrite: true,
	}
	dash, err := sqlStore.SaveDashboard(cmd)
	require.NoError(t, err)

	return dash
}
