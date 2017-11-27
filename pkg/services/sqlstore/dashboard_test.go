package sqlstore

import (
	"testing"

	"github.com/go-xorm/xorm"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardDataAccess(t *testing.T) {
	var x *xorm.Engine

	Convey("Testing DB", t, func() {
		x = InitTestDB(t)

		Convey("Given saved dashboard", func() {
			savedFolder := insertTestDashboard("1 test dash folder", 1, 0, true, "prod", "webapp")
			savedDash := insertTestDashboard("test dash 23", 1, savedFolder.Id, false, "prod", "webapp")
			insertTestDashboard("test dash 45", 1, savedFolder.Id, false, "prod")
			insertTestDashboard("test dash 67", 1, 0, false, "prod", "webapp")

			Convey("Should return dashboard model", func() {
				So(savedDash.Title, ShouldEqual, "test dash 23")
				So(savedDash.Slug, ShouldEqual, "test-dash-23")
				So(savedDash.Id, ShouldNotEqual, 0)
				So(savedDash.IsFolder, ShouldBeFalse)
				So(savedDash.FolderId, ShouldBeGreaterThan, 0)

				So(savedFolder.Title, ShouldEqual, "1 test dash folder")
				So(savedFolder.Slug, ShouldEqual, "1-test-dash-folder")
				So(savedFolder.Id, ShouldNotEqual, 0)
				So(savedFolder.IsFolder, ShouldBeTrue)
				So(savedFolder.FolderId, ShouldEqual, 0)
			})

			Convey("Should be able to get dashboard", func() {
				query := m.GetDashboardQuery{
					Slug:  "test-dash-23",
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.IsFolder, ShouldBeFalse)
			})

			Convey("Should be able to delete dashboard", func() {
				dash := insertTestDashboard("delete me", 1, 0, false, "delete this")

				err := DeleteDashboard(&m.DeleteDashboardCommand{
					Id:    dash.Id,
					OrgId: 1,
				})

				So(err, ShouldBeNil)
			})

			Convey("Should return error if no dashboard is updated", func() {
				cmd := m.SaveDashboardCommand{
					OrgId:     1,
					Overwrite: true,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    float64(123412321),
						"title": "Expect error",
						"tags":  []interface{}{},
					}),
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Should not be able to overwrite dashboard in another org", func() {
				query := m.GetDashboardQuery{Slug: "test-dash-23", OrgId: 1}
				GetDashboard(&query)

				cmd := m.SaveDashboardCommand{
					OrgId:     2,
					Overwrite: true,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    float64(query.Result.Id),
						"title": "Expect error",
						"tags":  []interface{}{},
					}),
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Should be able to search for dashboard folder", func() {
				query := search.FindPersistedDashboardsQuery{
					Title:        "1 test dash folder",
					OrgId:        1,
					SignedInUser: &m.SignedInUser{OrgId: 1},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				hit := query.Result[0]
				So(hit.Type, ShouldEqual, search.DashHitFolder)
			})

			Convey("Should be able to search for a dashboard folder's children", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &m.SignedInUser{OrgId: 1},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
				hit := query.Result[0]
				So(hit.Id, ShouldEqual, savedDash.Id)
			})

			Convey("Should be able to search for dashboard by dashboard ids", func() {
				Convey("should be able to find two dashboards by id", func() {
					query := search.FindPersistedDashboardsQuery{
						DashboardIds: []int64{2, 3},
						SignedInUser: &m.SignedInUser{OrgId: 1},
					}

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)

					hit := query.Result[0]
					So(len(hit.Tags), ShouldEqual, 2)

					hit2 := query.Result[1]
					So(len(hit2.Tags), ShouldEqual, 1)
				})

				Convey("DashboardIds that does not exists should not cause errors", func() {
					query := search.FindPersistedDashboardsQuery{
						DashboardIds: []int64{1000},
						SignedInUser: &m.SignedInUser{OrgId: 1},
					}

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 0)
				})
			})

			Convey("Should not be able to save dashboard with same name", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "test dash 23",
						"tags":  []interface{}{},
					}),
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Should be able to update dashboard and remove folderId", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    1,
						"title": "folderId",
						"tags":  []interface{}{},
					}),
					Overwrite: true,
					FolderId:  2,
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
				So(cmd.Result.FolderId, ShouldEqual, 2)

				cmd = m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    1,
						"title": "folderId",
						"tags":  []interface{}{},
					}),
					FolderId:  0,
					Overwrite: true,
				}

				err = SaveDashboard(&cmd)
				So(err, ShouldBeNil)

				query := m.GetDashboardQuery{
					Slug:  cmd.Result.Slug,
					OrgId: 1,
				}

				err = GetDashboard(&query)
				So(err, ShouldBeNil)
				So(query.Result.FolderId, ShouldEqual, 0)
			})

			Convey("Should be able to delete a dashboard folder and its children", func() {
				deleteCmd := &m.DeleteDashboardCommand{Id: savedFolder.Id}
				err := DeleteDashboard(deleteCmd)
				So(err, ShouldBeNil)

				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &m.SignedInUser{},
				}

				err = SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 0)
			})

			Convey("Should be able to get dashboard tags", func() {
				query := m.GetDashboardTagsQuery{OrgId: 1}

				err := GetDashboardTags(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
			})

			Convey("Given two dashboards, one is starred dashboard by user 10, other starred by user 1", func() {
				starredDash := insertTestDashboard("starred dash", 1, 0, false)
				StarDashboard(&m.StarDashboardCommand{
					DashboardId: starredDash.Id,
					UserId:      10,
				})

				StarDashboard(&m.StarDashboardCommand{
					DashboardId: savedDash.Id,
					UserId:      1,
				})

				Convey("Should be able to search for starred dashboards", func() {
					query := search.FindPersistedDashboardsQuery{SignedInUser: &m.SignedInUser{UserId: 10, OrgId: 1}, IsStarred: true}
					err := SearchDashboards(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Title, ShouldEqual, "starred dash")
				})
			})
		})

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

		Convey("Given a plugin with imported dashboards", func() {
			pluginId := "test-app"

			appFolder := insertTestDashboardForPlugin("app-test", 1, 0, true, pluginId)
			insertTestDashboardForPlugin("app-dash1", 1, appFolder.Id, false, pluginId)
			insertTestDashboardForPlugin("app-dash2", 1, appFolder.Id, false, pluginId)

			Convey("Should return imported dashboard", func() {
				query := m.GetDashboardsByPluginIdQuery{
					PluginId: pluginId,
					OrgId:    1,
				}

				err := GetDashboardsByPluginId(&query)
				So(err, ShouldBeNil)
				So(len(query.Result), ShouldEqual, 2)
			})
		})
	})
}

func insertTestDashboard(title string, orgId int64, folderId int64, isFolder bool, tags ...interface{}) *m.Dashboard {
	cmd := m.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
			"tags":  tags,
		}),
	}

	err := SaveDashboard(&cmd)
	So(err, ShouldBeNil)

	return cmd.Result
}

func insertTestDashboardForPlugin(title string, orgId int64, folderId int64, isFolder bool, pluginId string) *m.Dashboard {
	cmd := m.SaveDashboardCommand{
		OrgId:    orgId,
		FolderId: folderId,
		IsFolder: isFolder,
		Dashboard: simplejson.NewFromAny(map[string]interface{}{
			"id":    nil,
			"title": title,
		}),
		PluginId: pluginId,
	}

	err := SaveDashboard(&cmd)
	So(err, ShouldBeNil)

	return cmd.Result
}

func createUser(name string, role string, isAdmin bool) m.User {
	setting.AutoAssignOrg = true
	setting.AutoAssignOrgRole = role

	currentUserCmd := m.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: isAdmin}
	err := CreateUser(&currentUserCmd)
	So(err, ShouldBeNil)

	q1 := m.GetUserOrgListQuery{UserId: currentUserCmd.Result.Id}
	GetUserOrgList(&q1)
	So(q1.Result[0].Role, ShouldEqual, role)

	return currentUserCmd.Result
}

func updateTestDashboardWithAcl(dashId int64, userId int64, permissions m.PermissionType) int64 {
	cmd := &m.SetDashboardAclCommand{
		OrgId:       1,
		UserId:      userId,
		DashboardId: dashId,
		Permission:  permissions,
	}

	err := SetDashboardAcl(cmd)
	So(err, ShouldBeNil)

	return cmd.Result.Id
}

func removeAcl(aclId int64) {
	err := RemoveDashboardAcl(&m.RemoveDashboardAclCommand{AclId: aclId, OrgId: 1})
	So(err, ShouldBeNil)
}

func moveDashboard(orgId int64, dashboard *simplejson.Json, newFolderId int64) *m.Dashboard {
	cmd := m.SaveDashboardCommand{
		OrgId:     orgId,
		FolderId:  newFolderId,
		Dashboard: dashboard,
		Overwrite: true,
	}

	err := SaveDashboard(&cmd)
	So(err, ShouldBeNil)

	return cmd.Result
}
