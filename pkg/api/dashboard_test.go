package api

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardApiEndpoint(t *testing.T) {
	Convey("Given a dashboard with a parent folder which does not have an acl", t, func() {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.ParentId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		Convey("When user is an Org Viewer", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_VIEWER, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 200)

				dash := dtos.DashboardFullWithMeta{}
				err := json.NewDecoder(sc.resp.Body).Decode(&dash)
				So(err, ShouldBeNil)

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
				})
			})
		})

		Convey("When user is an Org Read Only Editor", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_READ_ONLY_EDITOR, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
				So(sc.resp.Code, ShouldEqual, 200)

				dash := dtos.DashboardFullWithMeta{}
				err := json.NewDecoder(sc.resp.Body).Decode(&dash)
				So(err, ShouldBeNil)

				Convey("Should be able to edit but not save the dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeFalse)
				})
			})
		})

		Convey("When user is an Org Editor", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_EDITOR, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				So(sc.resp.Code, ShouldEqual, 200)

				dash := dtos.DashboardFullWithMeta{}
				err := json.NewDecoder(sc.resp.Body).Decode(&dash)
				So(err, ShouldBeNil)

				Convey("Should be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
				})
			})
		})
	})

	Convey("Given a dashboard with a parent folder which has an acl", t, func() {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.ParentId = 1
		fakeDash.HasAcl = true

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		bus.AddHandler("test", func(query *models.GetUserGroupsByUserQuery) error {
			query.Result = []*models.UserGroup{}
			return nil
		})

		Convey("When user is an Org Viewer and has no permissions for this dashboard", func() {
			bus.AddHandler("test", func(query *models.GetDashboardPermissionsQuery) error {
				query.Result = []*models.DashboardAclInfoDTO{}
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_VIEWER, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})
		})

		Convey("When user is an Org Editor and has no permissions for this dashboard", func() {
			bus.AddHandler("test", func(query *models.GetDashboardPermissionsQuery) error {
				query.Result = []*models.DashboardAclInfoDTO{}
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_EDITOR, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})
		})

		Convey("When user is an Org Viewer but has an edit permission", func() {
			mockResult := []*models.DashboardAclInfoDTO{
				{Id: 1, OrgId: 1, DashboardId: 2, UserId: 1, PermissionType: models.PERMISSION_EDIT},
			}

			bus.AddHandler("test", func(query *models.GetDashboardPermissionsQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_VIEWER, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				So(sc.resp.Code, ShouldEqual, 200)

				dash := dtos.DashboardFullWithMeta{}
				err := json.NewDecoder(sc.resp.Body).Decode(&dash)
				So(err, ShouldBeNil)

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
				})
			})
		})

		Convey("When user is an Org Editor but has a view permission", func() {
			mockResult := []*models.DashboardAclInfoDTO{
				{Id: 1, OrgId: 1, DashboardId: 2, UserId: 1, PermissionType: models.PERMISSION_VIEW},
			}

			bus.AddHandler("test", func(query *models.GetDashboardPermissionsQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", models.ROLE_VIEWER, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				So(sc.resp.Code, ShouldEqual, 200)

				dash := dtos.DashboardFullWithMeta{}
				err := json.NewDecoder(sc.resp.Body).Decode(&dash)
				So(err, ShouldBeNil)

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
				})
			})
		})
	})
}
