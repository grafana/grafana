package sqlstore

import (
	"fmt"
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
				So(len(savedDash.Uid), ShouldBeGreaterThan, 0)

				So(savedFolder.Title, ShouldEqual, "1 test dash folder")
				So(savedFolder.Slug, ShouldEqual, "1-test-dash-folder")
				So(savedFolder.Id, ShouldNotEqual, 0)
				So(savedFolder.IsFolder, ShouldBeTrue)
				So(savedFolder.FolderId, ShouldEqual, 0)
				So(len(savedFolder.Uid), ShouldBeGreaterThan, 0)
			})

			Convey("Should be able to get dashboard by id", func() {
				query := m.GetDashboardQuery{
					Id:    savedDash.Id,
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.Id, ShouldEqual, savedDash.Id)
				So(query.Result.Uid, ShouldEqual, savedDash.Uid)
				So(query.Result.IsFolder, ShouldBeFalse)
			})

			Convey("Should be able to get dashboard by slug", func() {
				query := m.GetDashboardQuery{
					Slug:  "test-dash-23",
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.Id, ShouldEqual, savedDash.Id)
				So(query.Result.Uid, ShouldEqual, savedDash.Uid)
				So(query.Result.IsFolder, ShouldBeFalse)
			})

			Convey("Should be able to get dashboard by uid", func() {
				query := m.GetDashboardQuery{
					Uid:   savedDash.Uid,
					OrgId: 1,
				}

				err := GetDashboard(&query)
				So(err, ShouldBeNil)

				So(query.Result.Title, ShouldEqual, "test dash 23")
				So(query.Result.Slug, ShouldEqual, "test-dash-23")
				So(query.Result.Id, ShouldEqual, savedDash.Id)
				So(query.Result.Uid, ShouldEqual, savedDash.Uid)
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
				So(hit.Url, ShouldEqual, fmt.Sprintf("/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
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
				So(hit.Url, ShouldEqual, fmt.Sprintf("/d/%s/%s", savedDash.Uid, savedDash.Slug))
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

			Convey("Should be able to save dashboards with same name in different folders", func() {
				firstSaveCmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "test dash folder and title",
						"tags":  []interface{}{},
						"uid":   "randomHash",
					}),
					FolderId: 3,
				}

				err := SaveDashboard(&firstSaveCmd)
				So(err, ShouldBeNil)

				secondSaveCmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "test dash folder and title",
						"tags":  []interface{}{},
						"uid":   "moreRandomHash",
					}),
					FolderId: 1,
				}

				err = SaveDashboard(&secondSaveCmd)
				So(err, ShouldBeNil)
			})

			Convey("Should not be able to save dashboard with same name in the same folder", func() {
				firstSaveCmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "test dash folder and title",
						"tags":  []interface{}{},
						"uid":   "randomHash",
					}),
					FolderId: 3,
				}

				err := SaveDashboard(&firstSaveCmd)
				So(err, ShouldBeNil)

				secondSaveCmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "test dash folder and title",
						"tags":  []interface{}{},
						"uid":   "moreRandomHash",
					}),
					FolderId: 3,
				}

				err = SaveDashboard(&secondSaveCmd)
				So(err, ShouldEqual, m.ErrDashboardWithSameNameInFolderExists)
			})

			Convey("Should not be able to save dashboard with same uid", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    nil,
						"title": "test dash 23",
						"uid":   "dsfalkjngailuedt",
					}),
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
				err = SaveDashboard(&cmd)
				So(err, ShouldNotBeNil)
			})

			Convey("Should be able to update dashboard with the same title and folder id", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						//"id": 1,
						"uid":     "randomHash",
						"title":   "folderId",
						"style":   "light",
						"tags":    []interface{}{},
					}),
					FolderId: 2,
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
				So(cmd.Result.FolderId, ShouldEqual, 2)

				cmd = m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":      cmd.Result.Id,
						"uid":     "randomHash",
						"title":   "folderId",
						"style":   "dark",
						"version": cmd.Result.Version,
						"tags":    []interface{}{},
					}),
					FolderId: 2,
				}

				err = SaveDashboard(&cmd)
				So(err, ShouldBeNil)
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
