package sqlstore

import (
	"testing"

	"github.com/go-xorm/xorm"
	. "github.com/smartystreets/goconvey/convey"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func TestDashboardFolderDataAccess(t *testing.T) {
	var x *xorm.Engine

	Convey("Testing DB", t, func() {
		x = InitTestDB(t)

		Convey("Given one dashboard folder with two dashboards and one dashboard in the root folder", func() {
			folder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			dashInRoot := insertTestDashboard("test dash 67", 1, 0, false, "prod", "webapp")
			childDash := insertTestDashboard("test dash 23", 1, folder.Id, false, "prod", "webapp")
			insertTestDashboard("test dash 45", 1, folder.Id, false, "prod")

			currentUser := createUser("viewer", "Viewer", false)

			Convey("and no acls are set", func() {
				Convey("should return all dashboards", func() {
					query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1}, OrgId: 1, DashboardIds: []int64{folder.Id, dashInRoot.Id}}
					err := SearchDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 2)
					So(query.Result[0].Id, ShouldEqual, folder.Id)
					So(query.Result[1].Id, ShouldEqual, dashInRoot.Id)
				})
			})

			Convey("and acl is set for dashboard folder", func() {
				var otherUser int64 = 999
				updateTestDashboardWithAcl(folder.Id, otherUser, m.PERMISSION_EDIT)

				Convey("should not return folder", func() {
					query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1}, OrgId: 1, DashboardIds: []int64{folder.Id, dashInRoot.Id}}
					err := SearchDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Id, ShouldEqual, dashInRoot.Id)
				})

				Convey("when the user is given permission", func() {
					updateTestDashboardWithAcl(folder.Id, currentUser.Id, m.PERMISSION_EDIT)

					Convey("should be able to access folder", func() {
						query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1}, OrgId: 1, DashboardIds: []int64{folder.Id, dashInRoot.Id}}
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
				aclId := updateTestDashboardWithAcl(folder.Id, otherUser, m.PERMISSION_EDIT)
				removeAcl(aclId)
				updateTestDashboardWithAcl(childDash.Id, otherUser, m.PERMISSION_EDIT)

				Convey("should not return folder or child", func() {
					query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id}}
					err := SearchDashboards(query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Id, ShouldEqual, dashInRoot.Id)
				})

				Convey("when the user is given permission to child", func() {
					updateTestDashboardWithAcl(childDash.Id, currentUser.Id, m.PERMISSION_EDIT)

					Convey("should be able to search for child dashboard but not folder", func() {
						query := &search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1}, OrgId: 1, DashboardIds: []int64{folder.Id, childDash.Id, dashInRoot.Id}}
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
					query := &search.FindPersistedDashboardsQuery{FolderIds: []int64{rootFolderId, folder1.Id}, SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1}, OrgId: 1}
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
				updateTestDashboardWithAcl(folder1.Id, otherUser, m.PERMISSION_EDIT)

				Convey("and a dashboard is moved from folder without acl to the folder with an acl", func() {
					movedDash := moveDashboard(1, childDash2.Data, folder1.Id)
					So(movedDash.HasAcl, ShouldBeTrue)

					Convey("should not return folder with acl or its children", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1},
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
					movedDash := moveDashboard(1, childDash1.Data, folder2.Id)
					So(movedDash.HasAcl, ShouldBeFalse)

					Convey("should return folder without acl and its children", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1},
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
					updateTestDashboardWithAcl(childDash1.Id, otherUser, m.PERMISSION_EDIT)
					movedDash := moveDashboard(1, childDash1.Data, folder2.Id)
					So(movedDash.HasAcl, ShouldBeTrue)

					Convey("should return folder without acl but not the dashboard with acl", func() {
						query := &search.FindPersistedDashboardsQuery{
							SignedInUser: &m.SignedInUser{UserId: currentUser.Id, OrgId: 1},
							OrgId:        1,
							DashboardIds: []int64{folder2.Id, childDash1.Id, childDash2.Id, dashInRoot.Id},
						}
						err := SearchDashboards(query)
						So(err, ShouldBeNil)
						So(len(query.Result), ShouldEqual, 3)
						So(query.Result[0].Id, ShouldEqual, folder2.Id)
						So(query.Result[1].Id, ShouldEqual, childDash2.Id)
						So(query.Result[2].Id, ShouldEqual, dashInRoot.Id)
					})
				})
			})
		})

	})
}
