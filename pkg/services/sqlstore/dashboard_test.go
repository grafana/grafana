package sqlstore

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardDataAccess(t *testing.T) {
	Convey("Testing DB", t, func() {
		InitTestDB(t)

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

			Convey("Should retry generation of uid once if it fails.", func() {
				timesCalled := 0
				generateNewUid = func() string {
					timesCalled += 1
					if timesCalled <= 2 {
						return savedDash.Uid
					}
					return util.GenerateShortUID()
				}
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"title": "new dash 12334",
						"tags":  []interface{}{},
					}),
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)

				generateNewUid = util.GenerateShortUID
			})

			Convey("Should be able to create dashboard", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"title": "folderId",
						"tags":  []interface{}{},
					}),
					UserId: 100,
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
				So(cmd.Result.CreatedBy, ShouldEqual, 100)
				So(cmd.Result.Created.IsZero(), ShouldBeFalse)
				So(cmd.Result.UpdatedBy, ShouldEqual, 100)
				So(cmd.Result.Updated.IsZero(), ShouldBeFalse)
			})

			Convey("Should be able to update dashboard by id and remove folderId", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    savedDash.Id,
						"title": "folderId",
						"tags":  []interface{}{},
					}),
					Overwrite: true,
					FolderId:  2,
					UserId:    100,
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
				So(cmd.Result.FolderId, ShouldEqual, 2)

				cmd = m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    savedDash.Id,
						"title": "folderId",
						"tags":  []interface{}{},
					}),
					FolderId:  0,
					Overwrite: true,
					UserId:    100,
				}

				err = SaveDashboard(&cmd)
				So(err, ShouldBeNil)

				query := m.GetDashboardQuery{
					Id:    savedDash.Id,
					OrgId: 1,
				}

				err = GetDashboard(&query)
				So(err, ShouldBeNil)
				So(query.Result.FolderId, ShouldEqual, 0)
				So(query.Result.CreatedBy, ShouldEqual, savedDash.CreatedBy)
				So(query.Result.Created, ShouldHappenWithin, 3*time.Second, savedDash.Created)
				So(query.Result.UpdatedBy, ShouldEqual, 100)
				So(query.Result.Updated.IsZero(), ShouldBeFalse)
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

			Convey("Should return error if no dashboard is found for update when dashboard id is greater than zero", func() {
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
				So(err, ShouldEqual, m.ErrDashboardNotFound)
			})

			Convey("Should not return error if no dashboard is found for update when dashboard id is zero", func() {
				cmd := m.SaveDashboardCommand{
					OrgId:     1,
					Overwrite: true,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    0,
						"title": "New dash",
						"tags":  []interface{}{},
					}),
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
			})

			Convey("Should be able to get dashboard tags", func() {
				query := m.GetDashboardTagsQuery{OrgId: 1}

				err := GetDashboardTags(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
			})

			Convey("Should be able to search for dashboard folder", func() {
				query := search.FindPersistedDashboardsQuery{
					Title:        "1 test dash folder",
					OrgId:        1,
					SignedInUser: &m.SignedInUser{OrgId: 1, OrgRole: m.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				hit := query.Result[0]
				So(hit.Type, ShouldEqual, search.DashHitFolder)
				So(hit.Url, ShouldEqual, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
				So(hit.FolderTitle, ShouldEqual, "")
			})

			Convey("Should be able to limit search", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Limit:        1,
					SignedInUser: &m.SignedInUser{OrgId: 1, OrgRole: m.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Title, ShouldEqual, "1 test dash folder")
			})

			Convey("Should be able to search beyond limit using paging", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					Limit:        1,
					Page:         2,
					SignedInUser: &m.SignedInUser{OrgId: 1, OrgRole: m.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				So(query.Result[0].Title, ShouldEqual, "1 test dash folder")
			})

			Convey("Should be able to search for a dashboard folder's children", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:        1,
					FolderIds:    []int64{savedFolder.Id},
					SignedInUser: &m.SignedInUser{OrgId: 1, OrgRole: m.ROLE_EDITOR},
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 2)
				hit := query.Result[0]
				So(hit.Id, ShouldEqual, savedDash.Id)
				So(hit.Url, ShouldEqual, fmt.Sprintf("/d/%s/%s", savedDash.Uid, savedDash.Slug))
				So(hit.FolderId, ShouldEqual, savedFolder.Id)
				So(hit.FolderUid, ShouldEqual, savedFolder.Uid)
				So(hit.FolderTitle, ShouldEqual, savedFolder.Title)
				So(hit.FolderUrl, ShouldEqual, fmt.Sprintf("/dashboards/f/%s/%s", savedFolder.Uid, savedFolder.Slug))
			})

			Convey("Should be able to search for dashboard by dashboard ids", func() {
				Convey("should be able to find two dashboards by id", func() {
					query := search.FindPersistedDashboardsQuery{
						DashboardIds: []int64{2, 3},
						SignedInUser: &m.SignedInUser{OrgId: 1, OrgRole: m.ROLE_EDITOR},
					}

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result), ShouldEqual, 2)

					hit := query.Result[0]
					So(len(hit.Tags), ShouldEqual, 2)

					hit2 := query.Result[1]
					So(len(hit2.Tags), ShouldEqual, 1)
				})
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
					query := search.FindPersistedDashboardsQuery{
						SignedInUser: &m.SignedInUser{UserId: 10, OrgId: 1, OrgRole: m.ROLE_EDITOR},
						IsStarred:    true,
					}
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

	cmd.Result.Data.Set("id", cmd.Result.Id)
	cmd.Result.Data.Set("uid", cmd.Result.Uid)

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
	setting.AutoAssignOrgId = 1
	setting.AutoAssignOrgRole = role

	currentUserCmd := m.CreateUserCommand{Login: name, Email: name + "@test.com", Name: "a " + name, IsAdmin: isAdmin}
	err := CreateUser(context.Background(), &currentUserCmd)
	So(err, ShouldBeNil)

	q1 := m.GetUserOrgListQuery{UserId: currentUserCmd.Result.Id}
	GetUserOrgList(&q1)
	So(q1.Result[0].Role, ShouldEqual, role)

	return currentUserCmd.Result
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
