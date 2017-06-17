package sqlstore

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/grafana/grafana/pkg/components/simplejson"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/search"
)

func insertTestDashboard(title string, orgId int64, parentId int64, isFolder bool, tags ...interface{}) *m.Dashboard {
	cmd := m.SaveDashboardCommand{
		OrgId:    orgId,
		ParentId: parentId,
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
				So(savedDash.ParentId, ShouldBeGreaterThan, 0)

				So(savedFolder.Title, ShouldEqual, "1 test dash folder")
				So(savedFolder.Slug, ShouldEqual, "1-test-dash-folder")
				So(savedFolder.Id, ShouldNotEqual, 0)
				So(savedFolder.IsFolder, ShouldBeTrue)
				So(savedFolder.ParentId, ShouldEqual, 0)
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

			Convey("Should be able to search for dashboard and return in folder hierarchy", func() {
				query := search.FindPersistedDashboardsQuery{
					Title: "test dash 23",
					OrgId: 1,
					Mode:  "tree",
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				hit := query.Result[0].Dashboards[0]

				So(len(hit.Tags), ShouldEqual, 2)
				So(hit.Type, ShouldEqual, search.DashHitDB)
				So(hit.ParentId, ShouldBeGreaterThan, 0)

			})

			Convey("Should be able to search for dashboard folder", func() {
				query := search.FindPersistedDashboardsQuery{
					Title: "1 test dash folder",
					OrgId: 1,
				}

				err := SearchDashboards(&query)
				So(err, ShouldBeNil)

				So(len(query.Result), ShouldEqual, 1)
				hit := query.Result[0]
				So(hit.Type, ShouldEqual, search.DashHitFolder)
			})

			Convey("Should be able to search for a dashboard folder's children", func() {
				query := search.FindPersistedDashboardsQuery{
					OrgId:    1,
					ParentId: savedFolder.Id,
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
						DashboardIds: []int{2, 3},
						OrgId:        1,
						Mode:         "tree",
					}

					err := SearchDashboards(&query)
					So(err, ShouldBeNil)

					So(len(query.Result[0].Dashboards), ShouldEqual, 2)

					hit := query.Result[0].Dashboards[0]
					So(len(hit.Tags), ShouldEqual, 2)

					hit2 := query.Result[0].Dashboards[1]
					So(len(hit2.Tags), ShouldEqual, 1)
				})

				Convey("DashboardIds that does not exists should not cause errors", func() {
					query := search.FindPersistedDashboardsQuery{
						DashboardIds: []int{1000},
						OrgId:        1,
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

			Convey("Should be able to update dashboard and remove parentId", func() {
				cmd := m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    1,
						"title": "parentId",
						"tags":  []interface{}{},
					}),
					Overwrite: true,
					ParentId:  2,
				}

				err := SaveDashboard(&cmd)
				So(err, ShouldBeNil)
				So(cmd.Result.ParentId, ShouldEqual, 2)

				cmd = m.SaveDashboardCommand{
					OrgId: 1,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"id":    1,
						"title": "parentId",
						"tags":  []interface{}{},
					}),
					ParentId:  0,
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
				So(query.Result.ParentId, ShouldEqual, 0)
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
					query := search.FindPersistedDashboardsQuery{OrgId: 1, UserId: 10, IsStarred: true}
					err := SearchDashboards(&query)

					So(err, ShouldBeNil)
					So(len(query.Result), ShouldEqual, 1)
					So(query.Result[0].Title, ShouldEqual, "starred dash")
				})
			})
		})
	})
}
