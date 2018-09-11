package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func TestDashboardFolderDataAccess(t *testing.T) {
	Convey("Testing DB", t, func() {
		InitTestDB(t)

		Convey("Given one dashboard folder with two dashboards and one dashboard in the root folder", func() {
			folder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot := insertTestDashboard("test dash 67", 1, 0, false, "prod", "webapp")
			childDash := insertTestDashboard("test dash 23", 1, folder.Id, false, "prod", "webapp")
			insertTestDashboard("test dash 45", 1, folder.Id, false, "prod")

			currentUser := createUser("viewer", "Viewer", false)

			Convey("and no acls are set", func() {
				Convey("should return all dashboards", func() {
					query := &search.FindPersistedDashboardsQuery{
						SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
						OrgId:        1,
						DashboardIds: []int64{folder.Id, dashInRoot.Id},
					}
					err := SearchDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Id, ShouldEqual, folder.Id)
					So(query.Result[1].Id, ShouldEqual, dashInRoot.Id)
				})
			})

			Convey("and acl is set for dashboard folder", func() {
				var otherUser int64 = 999
				testHelperUpdateDashboardAcl(folder.Id, m.DashboardAcl{DashboardId: folder.Id, OrgId: 1, UserId: otherUser, Permission: m.PERMISSION_EDIT})

				Convey("should not return folder", func() {
					query := &search.FindPersistedDashboardsQuery{
						SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
						OrgId:        1, DashboardIds: []int64{folder.Id, dashInRoot.Id},
					}
					err := SearchDashboards(query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Id, ShouldEqual, dashInRoot.Id)
				})

				Convey("when the user is given permission", func() {
					testHelperUpdateDashboardAcl(folder.Id, m.DashboardAcl{DashboardId: folder.Id, OrgId: 1, UserId: currentUser.Id, Permission: m.PERMISSION_EDIT})

					Convey("should be able to access folder", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 2)
						So(query.Result[0].Id, ShouldEqual, folder.Id)
						So(query.Result[1].Id, ShouldEqual, dashInRoot.Id)
					})
				})

				Convey("when the user is an admin", func() {
					Convey("should be able to access folder", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{
								UserId:  currentUser.Id,
								OrgId:   1,
								OrgRole: m.ROLE_ADMIN,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 2)
						So(query.Result[0].Id, ShouldEqual, folder.Id)
						So(query.Result[1].Id, ShouldEqual, dashInRoot.Id)
					})
				})
			})

			Convey("and acl is set for dashboard child and folder has all permissions removed", func() {
				var otherUser int64 = 999
				testHelperUpdateDashboardAcl(folder.Id)
				testHelperUpdateDashboardAcl(childDash.Id, m.DashboardAcl{DashboardId: folder.Id, OrgId: 1, UserId: otherUser, Permission: m.PERMISSION_EDIT})

				Convey("should not return folder or child", func() {
					query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id}}
					err := SearchDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Id, ShouldEqual, dashInRoot.Id)
				})

				Convey("when the user is given permission to child", func() {
					testHelperUpdateDashboardAcl(childDash.Id, m.DashboardAcl{DashboardId: childDash.Id, OrgId: 1, UserId: currentUser.Id, Permission: m.PERMISSION_EDIT})

					Convey("should be able to search for child dashboard but not folder", func() {
						query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id}}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 2)
						So(query.Result[0].Id, ShouldEqual, childDash.Id)
						So(query.Result[1].Id, ShouldEqual, dashInRoot.Id)
					})
				})

				Convey("when the user is an admin", func() {
					Convey("should be able to search for child dash and folder", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{
								UserId:  currentUser.Id,
								OrgId:   1,
								OrgRole: m.ROLE_ADMIN,
							},
							OrgId:        1,
							DashboardIds: []int64{folder.Id, dashInRoot.Id, childDash.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 3)
						So(query.Result[0].Id, ShouldEqual, folder.Id)
						So(query.Result[1].Id, ShouldEqual, childDash.Id)
						So(query.Result[2].Id, ShouldEqual, dashInRoot.Id)
					})
				})
			})
		})

		Convey("Given two dashboard folders with one dashboard each and one dashboard in the root folder", func() {
			folder1 := insertTestDashboard("1 test dash folder", 1, 0, true, "prod")
			folder2 := insertTestDashboard("2 test dash folder", 1, 0, true, "prod")
			dashInRoot := insertTestDashboard("test dash 67", 1, 0, false, "prod")
			childDash1 := insertTestDashboard("child dash 1", 1, folder1.Id, false, "prod")
			childDash2 := insertTestDashboard("child dash 2", 1, folder2.Id, false, "prod")

			currentUser := createUser("viewer", "Viewer", false)
			var rootFolderId int64 = 0

			Convey("and one folder is expanded, the other collapsed", func() {
				Convey("should return dashboards in root and expanded folder", func() {
					query := &search.FindPersistedDashboardsQuery{FolderIds: []int64{rootFolderId, folder1.Id}, SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER}, OrgId: 1}
					err := SearchDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 4)
					So(query.Result[0].Id, ShouldEqual, folder1.Id)
					So(query.Result[1].Id, ShouldEqual, folder2.Id)
					So(query.Result[2].Id, ShouldEqual, childDash1.Id)
					So(query.Result[3].Id, ShouldEqual, dashInRoot.Id)
				})
			})

			Convey("and acl is set for one dashboard folder", func() {
				var otherUser int64 = 999
				testHelperUpdateDashboardAcl(folder1.Id, m.DashboardAcl{DashboardId: folder1.Id, OrgId: 1, UserId: otherUser, Permission: m.PERMISSION_EDIT})

				Convey("and a dashboard is moved from folder without acl to the folder with an acl", func() {
					moveDashboard(1, childDash2.Data, folder1.Id)

					Convey("should not return folder with acl or its children", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder1.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 1)
						So(query.Result[0].Id, ShouldEqual, dashInRoot.Id)
					})
				})
				Convey("and a dashboard is moved from folder with acl to the folder without an acl", func() {
					moveDashboard(1, childDash1.Data, folder2.Id)

					Convey("should return folder without acl and its children", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 4)
						So(query.Result[0].Id, ShouldEqual, folder2.Id)
						So(query.Result[1].Id, ShouldEqual, childDash1.Id)
						So(query.Result[2].Id, ShouldEqual, childDash2.Id)
						So(query.Result[3].Id, ShouldEqual, dashInRoot.Id)
					})
				})

				Convey("and a dashboard with an acl is moved to the folder without an acl", func() {
					testHelperUpdateDashboardAcl(childDash1.Id, m.DashboardAcl{DashboardId: childDash1.Id, OrgId: 1, UserId: otherUser, Permission: m.PERMISSION_EDIT})
					moveDashboard(1, childDash1.Data, folder2.Id)

					Convey("should return folder without acl but not the dashboard with acl", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 4)
						So(query.Result[0].Id, ShouldEqual, folder2.Id)
						So(query.Result[1].Id, ShouldEqual, childDash1.Id)
						So(query.Result[2].Id, ShouldEqual, childDash2.Id)
						So(query.Result[3].Id, ShouldEqual, dashInRoot.Id)
					})
				})
			})
		})

		Convey("Given two dashboard folders", func() {
			folder1 := insertTestDashboard("1 test dash folder", 1, 0, true, "prod")
			folder2 := insertTestDashboard("2 test dash folder", 1, 0, true, "prod")
			insertTestDashboard("folder in another org", 2, 0, true, "prod")

			adminUser := createUser("admin", "Admin", true)
			editorUser := createUser("editor", "Editor", false)
			viewerUser := createUser("viewer", "Viewer", false)

			Convey("Admin users", func() {
				Convey("Should have write access to all dashboard folders in their org", func() {
					query := search.FindPersistedDashboardsQuery{
						OrgId:        1,
						SignedInUser: &m.SignedInUser{UserId: adminUser.Id, OrgRole: m.ROLE_ADMIN, OrgId: 1},
						Permission:   m.PERMISSION_VIEW,
						Type:         "dash-folder",
					}

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Id, ShouldEqual, folder1.Id)
					So(query.Result[1].Id, ShouldEqual, folder2.Id)
				})

				Convey("should have write access to all folders and dashboards", func() {
					query := m.GetDashboardPermissionsForUserQuery{
						DashboardIds: []int64{folder1.Id, folder2.Id},
						OrgId:        1,
						UserId:       adminUser.Id,
						OrgRole:      m.ROLE_ADMIN,
					}

					err := GetDashboardPermissionsForUser(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].DashboardId, ShouldEqual, folder1.Id)
					So(query.Result[0].Permission, ShouldEqual, m.PERMISSION_ADMIN)
					So(query.Result[1].DashboardId, ShouldEqual, folder2.Id)
					So(query.Result[1].Permission, ShouldEqual, m.PERMISSION_ADMIN)
				})

				Convey("should have edit permission in folders", func() {
					query := &m.HasEditPermissionInFoldersQuery{
						SignedInUser: &m.SignedInUser{UserId: adminUser.Id, OrgId: 1, OrgRole: m.ROLE_ADMIN},
					}
					err := HasEditPermissionInFolders(query)
					So(err, ShouldBeNil)
					So(query.Result, ShouldBeTrue)
				})
			})

			Convey("Editor users", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &m.SignedInUser{UserId: editorUser.Id, OrgRole: m.ROLE_EDITOR, OrgId: 1},
					Permission:   m.PERMISSION_EDIT,
				}

				Convey("Should have write access to all dashboard folders with default ACL", func() {
					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Id, ShouldEqual, folder1.Id)
					So(query.Result[1].Id, ShouldEqual, folder2.Id)
				})

				Convey("should have edit access to folders with default ACL", func() {
					query := m.GetDashboardPermissionsForUserQuery{
						DashboardIds: []int64{folder1.Id, folder2.Id},
						OrgId:        1,
						UserId:       editorUser.Id,
						OrgRole:      m.ROLE_EDITOR,
					}

					err := GetDashboardPermissionsForUser(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].DashboardId, ShouldEqual, folder1.Id)
					So(query.Result[0].Permission, ShouldEqual, m.PERMISSION_EDIT)
					So(query.Result[1].DashboardId, ShouldEqual, folder2.Id)
					So(query.Result[1].Permission, ShouldEqual, m.PERMISSION_EDIT)
				})

				Convey("Should have write access to one dashboard folder if default role changed to view for one folder", func() {
					testHelperUpdateDashboardAcl(folder1.Id, m.DashboardAcl{DashboardId: folder1.Id, OrgId: 1, UserId: editorUser.Id, Permission: m.PERMISSION_VIEW})

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Id, ShouldEqual, folder2.Id)
				})

				Convey("should have edit permission in folders", func() {
					query := &m.HasEditPermissionInFoldersQuery{
						SignedInUser: &m.SignedInUser{UserId: editorUser.Id, OrgId: 1, OrgRole: m.ROLE_EDITOR},
					}
					err := HasEditPermissionInFolders(query)
					So(err, ShouldBeNil)
					So(query.Result, ShouldBeTrue)
				})
			})

			Convey("Viewer users", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					SignedInUser: &m.SignedInUser{UserId: viewerUser.Id, OrgRole: m.ROLE_VIEWER, OrgId: 1},
					Permission:   m.PERMISSION_EDIT,
				}

				Convey("Should have no write access to any dashboard folders with default ACL", func() {
					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 0)
				})

				Convey("should have view access to folders with default ACL", func() {
					query := m.GetDashboardPermissionsForUserQuery{
						DashboardIds: []int64{folder1.Id, folder2.Id},
						OrgId:        1,
						UserId:       viewerUser.Id,
						OrgRole:      m.ROLE_VIEWER,
					}

					err := GetDashboardPermissionsForUser(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].DashboardId, ShouldEqual, folder1.Id)
					So(query.Result[0].Permission, ShouldEqual, m.PERMISSION_VIEW)
					So(query.Result[1].DashboardId, ShouldEqual, folder2.Id)
					So(query.Result[1].Permission, ShouldEqual, m.PERMISSION_VIEW)
				})

				Convey("Should be able to get one dashboard folder if default role changed to edit for one folder", func() {
					testHelperUpdateDashboardAcl(folder1.Id, m.DashboardAcl{DashboardId: folder1.Id, OrgId: 1, UserId: viewerUser.Id, Permission: m.PERMISSION_EDIT})

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Id, ShouldEqual, folder1.Id)
				})

				Convey("should not have edit permission in folders", func() {
					query := &m.HasEditPermissionInFoldersQuery{
						SignedInUser: &m.SignedInUser{UserId: viewerUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
					}
					err := HasEditPermissionInFolders(query)
					So(err, ShouldBeNil)
					So(query.Result, ShouldBeFalse)
				})

				Convey("and admin permission is given for user with org role viewer in one dashboard folder", func() {
					testHelperUpdateDashboardAcl(folder1.Id, m.DashboardAcl{DashboardId: folder1.Id, OrgId: 1, UserId: viewerUser.Id, Permission: m.PERMISSION_ADMIN})

					Convey("should have edit permission in folders", func() {
						query := &m.HasEditPermissionInFoldersQuery{
							SignedInUser: &m.SignedInUser{UserId: viewerUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
						}
						err := HasEditPermissionInFolders(query)
						So(err, ShouldBeNil)
						So(query.Result, ShouldBeTrue)
					})
				})

				Convey("and edit permission is given for user with org role viewer in one dashboard folder", func() {
					testHelperUpdateDashboardAcl(folder1.Id, m.DashboardAcl{DashboardId: folder1.Id, OrgId: 1, UserId: viewerUser.Id, Permission: m.PERMISSION_EDIT})

					Convey("should have edit permission in folders", func() {
						query := &m.HasEditPermissionInFoldersQuery{
							SignedInUser: &m.SignedInUser{UserId: viewerUser.Id, OrgId: 1, OrgRole: m.ROLE_VIEWER},
						}
						err := HasEditPermissionInFolders(query)
						So(err, ShouldBeNil)
						So(query.Result, ShouldBeTrue)
					})
				})
			})
		})
	})
}
