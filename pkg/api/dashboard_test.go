package api

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

// This tests three main scenarios.
// If a user has access to execute an action on a dashboard:
//   1. and the dashboard is in a folder which does not have an acl
//   2. and the dashboard is in a folder which does have an acl
// 3. Post dashboard response tests

func TestDashboardApiEndpoint(t *testing.T) {
	Convey("Given a dashboard with a parent folder which does not have an acl", t, func() {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
			dashboards := []*models.Dashboard{fakeDash}
			query.Result = dashboards
			return nil
		})

		var getDashboardQueries []*models.GetDashboardQuery

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			getDashboardQueries = append(getDashboardQueries, query)
			return nil
		})

		bus.AddHandler("test", func(query *models.GetProvisionedDashboardDataByIdQuery) error {
			query.Result = nil
			return nil
		})

		viewerRole := models.ROLE_VIEWER
		editorRole := models.ROLE_EDITOR

		aclMockResp := []*models.DashboardAclInfoDTO{
			{Role: &viewerRole, Permission: models.PERMISSION_VIEW},
			{Role: &editorRole, Permission: models.PERMISSION_EDIT},
		}

		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
			query.Result = []*models.TeamDTO{}
			return nil
		})

		// This tests two scenarios:
		// 1. user is an org viewer
		// 2. user is an org editor

		Convey("When user is an Org Viewer", func() {
			role := models.ROLE_VIEWER

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Editor", func() {
			role := models.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 200)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 200)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})
	})

	Convey("Given a dashboard with a parent folder which has an acl", t, func() {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = true
		setting.ViewersCanEdit = false

		bus.AddHandler("test", func(query *models.GetProvisionedDashboardDataByIdQuery) error {
			query.Result = nil
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
			dashboards := []*models.Dashboard{fakeDash}
			query.Result = dashboards
			return nil
		})

		aclMockResp := []*models.DashboardAclInfoDTO{
			{
				DashboardId: 1,
				Permission:  models.PERMISSION_EDIT,
				UserId:      200,
			},
		}

		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		var getDashboardQueries []*models.GetDashboardQuery

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			getDashboardQueries = append(getDashboardQueries, query)
			return nil
		})

		bus.AddHandler("test", func(query *models.GetTeamsByUserQuery) error {
			query.Result = []*models.TeamDTO{}
			return nil
		})

		hs := &HTTPServer{
			Cfg: setting.NewCfg(),
		}

		// This tests six scenarios:
		// 1. user is an org viewer AND has no permissions for this dashboard
		// 2. user is an org editor AND has no permissions for this dashboard
		// 3. user is an org viewer AND has been granted edit permission for the dashboard
		// 4. user is an org viewer AND all viewers have edit permission for this dashboard
		// 5. user is an org viewer AND has been granted an admin permission
		// 6. user is an org editor AND has been granted a view permission

		Convey("When user is an Org Viewer and has no permissions for this dashboard", func() {
			role := models.ROLE_VIEWER

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				sc.handlerFunc = hs.GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				sc.handlerFunc = hs.GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Editor and has no permissions for this dashboard", func() {
			role := models.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				sc.handlerFunc = hs.GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				sc.handlerFunc = hs.GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Viewer but has an edit permission", func() {
			role := models.ROLE_VIEWER

			mockResult := []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_EDIT},
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 200)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 200)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})

		Convey("When user is an Org Viewer and viewers can edit", func() {
			role := models.ROLE_VIEWER
			setting.ViewersCanEdit = true

			mockResult := []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_VIEW},
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should be able to get dashboard with edit rights but can save should be false", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeFalse)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should be able to get dashboard with edit rights but can save should be false", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeFalse)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})
		})

		Convey("When user is an Org Viewer but has an admin permission", func() {
			role := models.ROLE_VIEWER

			mockResult := []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_ADMIN},
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeTrue)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeTrue)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 200)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 200)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})

		Convey("When user is an Org Editor but has a view permission", func() {
			role := models.ROLE_EDITOR

			mockResult := []*models.DashboardAclInfoDTO{
				{OrgId: 1, DashboardId: 2, UserId: 1, Permission: models.PERMISSION_VIEW},
			}

			bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/child-dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
				CallDeleteDashboardBySlug(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by slug", func() {
					So(getDashboardQueries[0].Slug, ShouldEqual, "child-dash")
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/uid/abcdefghi", "/api/dashboards/uid/:uid", role, func(sc *scenarioContext) {
				CallDeleteDashboardByUID(sc)
				So(sc.resp.Code, ShouldEqual, 403)

				Convey("Should lookup dashboard by uid", func() {
					So(getDashboardQueries[0].Uid, ShouldEqual, "abcdefghi")
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})
	})

	Convey("Given two dashboards with the same title in different folders", t, func() {
		dashOne := models.NewDashboard("dash")
		dashOne.Id = 2
		dashOne.FolderId = 1
		dashOne.HasAcl = false

		dashTwo := models.NewDashboard("dash")
		dashTwo.Id = 4
		dashTwo.FolderId = 3
		dashTwo.HasAcl = false

		bus.AddHandler("test", func(query *models.GetProvisionedDashboardDataByIdQuery) error {
			query.Result = nil
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
			dashboards := []*models.Dashboard{dashOne, dashTwo}
			query.Result = dashboards
			return nil
		})

		role := models.ROLE_EDITOR

		loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/dash", "/api/dashboards/db/:slug", role, func(sc *scenarioContext) {
			CallDeleteDashboardBySlug(sc)

			Convey("Should result in 412 Precondition failed", func() {
				So(sc.resp.Code, ShouldEqual, 412)
				result := sc.ToJSON()
				So(result.Get("status").MustString(), ShouldEqual, "multiple-slugs-exists")
				So(result.Get("message").MustString(), ShouldEqual, models.ErrDashboardsWithSameSlugExists.Error())
			})
		})
	})

	Convey("Post dashboard response tests", t, func() {

		// This tests that a valid request returns correct response

		Convey("Given a correct request for creating a dashboard", func() {
			cmd := models.SaveDashboardCommand{
				OrgId:  1,
				UserId: 5,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash",
				}),
				Overwrite: true,
				FolderId:  3,
				IsFolder:  false,
				Message:   "msg",
			}

			mock := &dashboards.FakeDashboardService{
				SaveDashboardResult: &models.Dashboard{
					Id:      2,
					Uid:     "uid",
					Title:   "Dash",
					Slug:    "dash",
					Version: 2,
				},
			}

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", mock, cmd, func(sc *scenarioContext) {
				CallPostDashboardShouldReturnSuccess(sc)

				Convey("It should call dashboard service with correct data", func() {
					dto := mock.SavedDashboards[0]
					So(dto.OrgId, ShouldEqual, cmd.OrgId)
					So(dto.User.UserId, ShouldEqual, cmd.UserId)
					So(dto.Dashboard.FolderId, ShouldEqual, 3)
					So(dto.Dashboard.Title, ShouldEqual, "Dash")
					So(dto.Overwrite, ShouldBeTrue)
					So(dto.Message, ShouldEqual, "msg")
				})

				Convey("It should return correct response data", func() {
					result := sc.ToJSON()
					So(result.Get("status").MustString(), ShouldEqual, "success")
					So(result.Get("id").MustInt64(), ShouldEqual, 2)
					So(result.Get("uid").MustString(), ShouldEqual, "uid")
					So(result.Get("slug").MustString(), ShouldEqual, "dash")
					So(result.Get("url").MustString(), ShouldEqual, "/d/uid/dash")
				})
			})
		})

		// This tests that invalid requests returns expected error responses

		Convey("Given incorrect requests for creating a dashboard", func() {
			testCases := []struct {
				SaveError          error
				ExpectedStatusCode int
			}{
				{SaveError: models.ErrDashboardNotFound, ExpectedStatusCode: 404},
				{SaveError: models.ErrFolderNotFound, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardWithSameUIDExists, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardWithSameNameInFolderExists, ExpectedStatusCode: 412},
				{SaveError: models.ErrDashboardVersionMismatch, ExpectedStatusCode: 412},
				{SaveError: models.ErrDashboardTitleEmpty, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardFolderCannotHaveParent, ExpectedStatusCode: 400},
				{SaveError: alerting.ValidationError{Reason: "Mu"}, ExpectedStatusCode: 422},
				{SaveError: models.ErrDashboardFailedGenerateUniqueUid, ExpectedStatusCode: 500},
				{SaveError: models.ErrDashboardTypeMismatch, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardFolderWithSameNameAsDashboard, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardWithSameNameAsFolder, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardFolderNameExists, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardUpdateAccessDenied, ExpectedStatusCode: 403},
				{SaveError: models.ErrDashboardInvalidUid, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardUidToLong, ExpectedStatusCode: 400},
				{SaveError: models.ErrDashboardCannotSaveProvisionedDashboard, ExpectedStatusCode: 400},
				{SaveError: models.UpdatePluginDashboardError{PluginId: "plug"}, ExpectedStatusCode: 412},
			}

			cmd := models.SaveDashboardCommand{
				OrgId: 1,
				Dashboard: simplejson.NewFromAny(map[string]interface{}{
					"title": "",
				}),
			}

			for _, tc := range testCases {
				mock := &dashboards.FakeDashboardService{
					SaveDashboardError: tc.SaveError,
				}

				postDashboardScenario(fmt.Sprintf("Expect '%s' error when calling POST on", tc.SaveError.Error()), "/api/dashboards", "/api/dashboards", mock, cmd, func(sc *scenarioContext) {
					CallPostDashboard(sc)
					So(sc.resp.Code, ShouldEqual, tc.ExpectedStatusCode)
				})
			}
		})
	})

	Convey("Given two dashboards being compared", t, func() {
		mockResult := []*models.DashboardAclInfoDTO{}
		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = mockResult
			return nil
		})

		bus.AddHandler("test", func(query *models.GetProvisionedDashboardDataByIdQuery) error {
			query.Result = nil
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
			query.Result = &models.DashboardVersion{
				Data: simplejson.NewFromAny(map[string]interface{}{
					"title": "Dash" + string(query.DashboardId),
				}),
			}
			return nil
		})

		cmd := dtos.CalculateDiffOptions{
			Base: dtos.CalculateDiffTarget{
				DashboardId: 1,
				Version:     1,
			},
			New: dtos.CalculateDiffTarget{
				DashboardId: 2,
				Version:     2,
			},
			DiffType: "basic",
		}

		Convey("when user does not have permission", func() {
			role := models.ROLE_VIEWER

			postDiffScenario("When calling POST on", "/api/dashboards/calculate-diff", "/api/dashboards/calculate-diff", cmd, role, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("when user does have permission", func() {
			role := models.ROLE_ADMIN

			postDiffScenario("When calling POST on", "/api/dashboards/calculate-diff", "/api/dashboards/calculate-diff", cmd, role, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})
	})

	Convey("Given dashboard in folder being restored should restore to folder", t, func() {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 2
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
			query.Result = &models.DashboardVersion{
				DashboardId: 2,
				Version:     1,
				Data:        fakeDash.Data,
			}
			return nil
		})

		mock := &dashboards.FakeDashboardService{
			SaveDashboardResult: &models.Dashboard{
				Id:      2,
				Uid:     "uid",
				Title:   "Dash",
				Slug:    "dash",
				Version: 1,
			},
		}

		cmd := dtos.RestoreDashboardVersionCommand{
			Version: 1,
		}

		restoreDashboardVersionScenario("When calling POST on", "/api/dashboards/id/1/restore", "/api/dashboards/id/:dashboardId/restore", mock, cmd, func(sc *scenarioContext) {
			CallRestoreDashboardVersion(sc)
			So(sc.resp.Code, ShouldEqual, 200)
			dto := mock.SavedDashboards[0]
			So(dto.Dashboard.FolderId, ShouldEqual, 1)
			So(dto.Dashboard.Title, ShouldEqual, "Child dash")
			So(dto.Message, ShouldEqual, "Restored from version 1")
		})
	})

	Convey("Given dashboard in general folder being restored should restore to general folder", t, func() {
		fakeDash := models.NewDashboard("Child dash")
		fakeDash.Id = 2
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
			query.Result = &models.DashboardVersion{
				DashboardId: 2,
				Version:     1,
				Data:        fakeDash.Data,
			}
			return nil
		})

		mock := &dashboards.FakeDashboardService{
			SaveDashboardResult: &models.Dashboard{
				Id:      2,
				Uid:     "uid",
				Title:   "Dash",
				Slug:    "dash",
				Version: 1,
			},
		}

		cmd := dtos.RestoreDashboardVersionCommand{
			Version: 1,
		}

		restoreDashboardVersionScenario("When calling POST on", "/api/dashboards/id/1/restore", "/api/dashboards/id/:dashboardId/restore", mock, cmd, func(sc *scenarioContext) {
			CallRestoreDashboardVersion(sc)
			So(sc.resp.Code, ShouldEqual, 200)
			dto := mock.SavedDashboards[0]
			So(dto.Dashboard.FolderId, ShouldEqual, 0)
			So(dto.Dashboard.Title, ShouldEqual, "Child dash")
			So(dto.Message, ShouldEqual, "Restored from version 1")
		})
	})

	Convey("Given provisioned dashboard", t, func() {

		bus.AddHandler("test", func(query *models.GetDashboardsBySlugQuery) error {
			query.Result = []*models.Dashboard{{}}
			return nil
		})
		bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
			query.Result = &models.Dashboard{Id: 1, Data: &simplejson.Json{}}
			return nil
		})

		bus.AddHandler("test", func(query *models.GetProvisionedDashboardDataByIdQuery) error {
			query.Result = &models.DashboardProvisioning{ExternalId: "/tmp/grafana/dashboards/test/dashboard1.json"}
			return nil
		})

		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = []*models.DashboardAclInfoDTO{
				{OrgId: TestOrgID, DashboardId: 1, UserId: TestUserID, Permission: models.PERMISSION_EDIT},
			}
			return nil
		})

		loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/dash", "/api/dashboards/db/:slug", models.ROLE_EDITOR, func(sc *scenarioContext) {
			CallDeleteDashboardBySlug(sc)

			Convey("Should result in 400", func() {
				So(sc.resp.Code, ShouldEqual, 400)
				result := sc.ToJSON()
				So(result.Get("error").MustString(), ShouldEqual, models.ErrDashboardCannotDeleteProvisionedDashboard.Error())
			})
		})

		loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/db/abcdefghi", "/api/dashboards/db/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			CallDeleteDashboardByUID(sc)

			Convey("Should result in 400", func() {
				So(sc.resp.Code, ShouldEqual, 400)
				result := sc.ToJSON()
				So(result.Get("error").MustString(), ShouldEqual, models.ErrDashboardCannotDeleteProvisionedDashboard.Error())
			})
		})

		loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/uid/dash", "/api/dashboards/uid/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			mock := provisioning.NewProvisioningServiceMock()
			mock.GetDashboardProvisionerResolvedPathFunc = func(name string) string {
				return "/tmp/grafana/dashboards"
			}

			dash := GetDashboardShouldReturn200WithConfig(sc, mock)

			Convey("Should return relative path to provisioning file", func() {
				So(dash.Meta.ProvisionedExternalId, ShouldEqual, "test/dashboard1.json")
			})
		})

		loggedInUserScenarioWithRole("When allowUiUpdates is true and calling GET on", "GET", "/api/dashboards/uid/dash", "/api/dashboards/uid/:uid", models.ROLE_EDITOR, func(sc *scenarioContext) {
			mock := provisioning.NewProvisioningServiceMock()
			mock.GetDashboardProvisionerResolvedPathFunc = func(name string) string {
				return "/tmp/grafana/dashboards"
			}
			mock.GetAllowUIUpdatesFromConfigFunc = func(name string) bool {
				return true
			}

			hs := &HTTPServer{
				Cfg:                 setting.NewCfg(),
				ProvisioningService: mock,
			}
			CallGetDashboard(sc, hs)

			So(sc.resp.Code, ShouldEqual, 200)

			dash := dtos.DashboardFullWithMeta{}
			err := json.NewDecoder(sc.resp.Body).Decode(&dash)
			So(err, ShouldBeNil)

			Convey("Should have metadata that says Provisioned is false", func() {
				So(dash.Meta.Provisioned, ShouldEqual, false)
			})
		})
	})
}

func GetDashboardShouldReturn200WithConfig(sc *scenarioContext, provisioningService provisioning.ProvisioningService) dtos.
	DashboardFullWithMeta {
	if provisioningService == nil {
		provisioningService = provisioning.NewProvisioningServiceMock()
	}

	hs := &HTTPServer{
		Cfg:                 setting.NewCfg(),
		ProvisioningService: provisioningService,
	}
	CallGetDashboard(sc, hs)

	So(sc.resp.Code, ShouldEqual, 200)

	dash := dtos.DashboardFullWithMeta{}
	err := json.NewDecoder(sc.resp.Body).Decode(&dash)
	So(err, ShouldBeNil)

	return dash
}

func GetDashboardShouldReturn200(sc *scenarioContext) dtos.DashboardFullWithMeta {
	return GetDashboardShouldReturn200WithConfig(sc, nil)
}

func CallGetDashboard(sc *scenarioContext, hs *HTTPServer) {

	sc.handlerFunc = hs.GetDashboard
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func CallGetDashboardVersion(sc *scenarioContext) {
	bus.AddHandler("test", func(query *models.GetDashboardVersionQuery) error {
		query.Result = &models.DashboardVersion{}
		return nil
	})

	sc.handlerFunc = GetDashboardVersion
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func CallGetDashboardVersions(sc *scenarioContext) {
	bus.AddHandler("test", func(query *models.GetDashboardVersionsQuery) error {
		query.Result = []*models.DashboardVersionDTO{}
		return nil
	})

	sc.handlerFunc = GetDashboardVersions
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func CallDeleteDashboardBySlug(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
		return nil
	})

	sc.handlerFunc = DeleteDashboardBySlug
	sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
}

func CallDeleteDashboardByUID(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.DeleteDashboardCommand) error {
		return nil
	})

	sc.handlerFunc = DeleteDashboardByUID
	sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
}

func CallPostDashboard(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func CallRestoreDashboardVersion(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func CallPostDashboardShouldReturnSuccess(sc *scenarioContext) {
	CallPostDashboard(sc)

	So(sc.resp.Code, ShouldEqual, 200)
}

func (m mockDashboardProvisioningService) DeleteProvisionedDashboard(dashboardId int64, orgId int64) error {
	panic("implement me")
}

func postDashboardScenario(desc string, url string, routePattern string, mock *dashboards.FakeDashboardService, cmd models.SaveDashboardCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Bus:                 bus.GetBus(),
			Cfg:                 setting.NewCfg(),
			ProvisioningService: provisioning.NewProvisioningServiceMock(),
		}

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{OrgId: cmd.OrgId, UserId: cmd.UserId}

			return hs.PostDashboard(c, cmd)
		})

		origNewDashboardService := dashboards.NewService
		dashboards.MockDashboardService(mock)

		origProvisioningService := dashboards.NewProvisioningService
		dashboards.NewProvisioningService = func() dashboards.DashboardProvisioningService {
			return mockDashboardProvisioningService{}
		}

		sc.m.Post(routePattern, sc.defaultHandler)

		defer func() {
			dashboards.NewService = origNewDashboardService
			dashboards.NewProvisioningService = origProvisioningService
		}()

		fn(sc)
	})
}

func postDiffScenario(desc string, url string, routePattern string, cmd dtos.CalculateDiffOptions, role models.RoleType, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{
				OrgId:  TestOrgID,
				UserId: TestUserID,
			}
			sc.context.OrgRole = role

			return CalculateDashboardDiff(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func restoreDashboardVersionScenario(desc string, url string, routePattern string, mock *dashboards.FakeDashboardService, cmd dtos.RestoreDashboardVersionCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		hs := HTTPServer{
			Cfg:                 setting.NewCfg(),
			Bus:                 bus.GetBus(),
			ProvisioningService: provisioning.NewProvisioningServiceMock(),
		}

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.SignedInUser = &models.SignedInUser{
				OrgId:  TestOrgID,
				UserId: TestUserID,
			}
			sc.context.OrgRole = models.ROLE_ADMIN

			return hs.RestoreDashboardVersion(c, cmd)
		})

		origProvisioningService := dashboards.NewProvisioningService
		dashboards.NewProvisioningService = func() dashboards.DashboardProvisioningService {
			return mockDashboardProvisioningService{}
		}

		origNewDashboardService := dashboards.NewService
		dashboards.MockDashboardService(mock)

		sc.m.Post(routePattern, sc.defaultHandler)

		defer func() {
			dashboards.NewService = origNewDashboardService
			dashboards.NewProvisioningService = origProvisioningService
		}()

		fn(sc)
	})
}

func (sc *scenarioContext) ToJSON() *simplejson.Json {
	var result *simplejson.Json
	err := json.NewDecoder(sc.resp.Body).Decode(&result)
	So(err, ShouldBeNil)
	return result
}

type mockDashboardProvisioningService struct {
}

func (m mockDashboardProvisioningService) SaveProvisionedDashboard(dto *dashboards.SaveDashboardDTO, provisioning *models.DashboardProvisioning) (*models.Dashboard, error) {
	panic("implement me")
}

func (m mockDashboardProvisioningService) SaveFolderForProvisionedDashboards(*dashboards.SaveDashboardDTO) (*models.Dashboard, error) {
	panic("implement me")
}

func (m mockDashboardProvisioningService) GetProvisionedDashboardData(name string) ([]*models.DashboardProvisioning, error) {
	panic("implement me")
}

func (mock mockDashboardProvisioningService) GetProvisionedDashboardDataByDashboardID(dashboardId int64) (*models.DashboardProvisioning, error) {
	return &models.DashboardProvisioning{}, nil
}

func (m mockDashboardProvisioningService) UnprovisionDashboard(dashboardId int64) error {
	panic("implement me")
}
