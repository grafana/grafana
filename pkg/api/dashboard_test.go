package api

import (
	"encoding/json"
	"path/filepath"
	"testing"

	macaron "gopkg.in/macaron.v1"

	"github.com/go-macaron/session"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

type fakeDashboardRepo struct {
	inserted     []*dashboards.SaveDashboardItem
	getDashboard []*m.Dashboard
}

func (repo *fakeDashboardRepo) SaveDashboard(json *dashboards.SaveDashboardItem) (*m.Dashboard, error) {
	repo.inserted = append(repo.inserted, json)
	return json.Dashboard, nil
}

var fakeRepo *fakeDashboardRepo

func TestDashboardApiEndpoint(t *testing.T) {
	Convey("Given a dashboard with a parent folder which does not have an acl", t, func() {
		fakeDash := m.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = false

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		viewerRole := m.ROLE_VIEWER
		editorRole := m.ROLE_EDITOR

		aclMockResp := []*m.DashboardAclInfoDTO{
			{Role: &viewerRole, Permission: m.PERMISSION_VIEW},
			{Role: &editorRole, Permission: m.PERMISSION_EDIT},
		}

		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = []*m.Team{}
			return nil
		})

		cmd := m.SaveDashboardCommand{
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"folderId": fakeDash.FolderId,
				"title":    fakeDash.Title,
				"id":       fakeDash.Id,
			}),
		}

		Convey("When user is an Org Viewer", func() {
			role := m.ROLE_VIEWER

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Editor", func() {
			role := m.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("When saving a dashboard folder in another folder", func() {
				bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
					query.Result = fakeDash
					query.Result.IsFolder = true
					return nil
				})
				invalidCmd := m.SaveDashboardCommand{
					FolderId: fakeDash.FolderId,
					IsFolder: true,
					Dashboard: simplejson.NewFromAny(map[string]interface{}{
						"folderId": fakeDash.FolderId,
						"title":    fakeDash.Title,
					}),
				}
				Convey("Should return an error", func() {
					postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, invalidCmd, func(sc *scenarioContext) {
						CallPostDashboard(sc)
						So(sc.resp.Code, ShouldEqual, 400)
					})
				})
			})
		})
	})

	Convey("Given a dashboard with a parent folder which has an acl", t, func() {
		fakeDash := m.NewDashboard("Child dash")
		fakeDash.Id = 1
		fakeDash.FolderId = 1
		fakeDash.HasAcl = true
		setting.ViewersCanEdit = false

		aclMockResp := []*m.DashboardAclInfoDTO{
			{
				DashboardId: 1,
				Permission:  m.PERMISSION_EDIT,
				UserId:      200,
			},
		}

		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = fakeDash
			return nil
		})

		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = []*m.Team{}
			return nil
		})

		cmd := m.SaveDashboardCommand{
			FolderId: fakeDash.FolderId,
			Dashboard: simplejson.NewFromAny(map[string]interface{}{
				"id":       fakeDash.Id,
				"folderId": fakeDash.FolderId,
				"title":    fakeDash.Title,
			}),
		}

		Convey("When user is an Org Viewer and has no permissions for this dashboard", func() {
			role := m.ROLE_VIEWER

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Editor and has no permissions for this dashboard", func() {
			role := m.ROLE_EDITOR

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				sc.handlerFunc = GetDashboard
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should be denied access", func() {
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Viewer but has an edit permission", func() {
			role := m.ROLE_VIEWER

			mockResult := []*m.DashboardAclInfoDTO{
				{Id: 1, OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_EDIT},
			}

			bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})

		Convey("When user is an Org Viewer and viewers can edit", func() {
			role := m.ROLE_VIEWER
			setting.ViewersCanEdit = true

			mockResult := []*m.DashboardAclInfoDTO{
				{Id: 1, OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_VIEW},
			}

			bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should be able to get dashboard with edit rights but can save should be false", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeFalse)
					So(dash.Meta.CanAdmin, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		Convey("When user is an Org Viewer but has an admin permission", func() {
			role := m.ROLE_VIEWER

			mockResult := []*m.DashboardAclInfoDTO{
				{Id: 1, OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_ADMIN},
			}

			bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should be able to get dashboard with edit rights", func() {
					So(dash.Meta.CanEdit, ShouldBeTrue)
					So(dash.Meta.CanSave, ShouldBeTrue)
					So(dash.Meta.CanAdmin, ShouldBeTrue)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})

		Convey("When user is an Org Editor but has a view permission", func() {
			role := m.ROLE_EDITOR

			mockResult := []*m.DashboardAclInfoDTO{
				{Id: 1, OrgId: 1, DashboardId: 2, UserId: 1, Permission: m.PERMISSION_VIEW},
			}

			bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
				query.Result = mockResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				dash := GetDashboardShouldReturn200(sc)

				Convey("Should not be able to edit or save dashboard", func() {
					So(dash.Meta.CanEdit, ShouldBeFalse)
					So(dash.Meta.CanSave, ShouldBeFalse)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/2", "/api/dashboards/:id", role, func(sc *scenarioContext) {
				CallDeleteDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions/1", "/api/dashboards/id/:dashboardId/versions/:id", role, func(sc *scenarioContext) {
				CallGetDashboardVersion(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/versions", "/api/dashboards/id/:dashboardId/versions", role, func(sc *scenarioContext) {
				CallGetDashboardVersions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			postDashboardScenario("When calling POST on", "/api/dashboards", "/api/dashboards", role, cmd, func(sc *scenarioContext) {
				CallPostDashboard(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})
	})
}

func GetDashboardShouldReturn200(sc *scenarioContext) dtos.DashboardFullWithMeta {
	sc.handlerFunc = GetDashboard
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

	So(sc.resp.Code, ShouldEqual, 200)

	dash := dtos.DashboardFullWithMeta{}
	err := json.NewDecoder(sc.resp.Body).Decode(&dash)
	So(err, ShouldBeNil)

	return dash
}

func CallGetDashboardVersion(sc *scenarioContext) {
	bus.AddHandler("test", func(query *m.GetDashboardVersionQuery) error {
		query.Result = &m.DashboardVersion{}
		return nil
	})

	sc.handlerFunc = GetDashboardVersion
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func CallGetDashboardVersions(sc *scenarioContext) {
	bus.AddHandler("test", func(query *m.GetDashboardVersionsQuery) error {
		query.Result = []*m.DashboardVersionDTO{}
		return nil
	})

	sc.handlerFunc = GetDashboardVersions
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func CallDeleteDashboard(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.DeleteDashboardCommand) error {
		return nil
	})

	sc.handlerFunc = DeleteDashboard
	sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()
}

func CallPostDashboard(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *alerting.ValidateDashboardAlertsCommand) error {
		return nil
	})

	bus.AddHandler("test", func(cmd *m.SaveDashboardCommand) error {
		cmd.Result = &m.Dashboard{Id: 2, Slug: "Dash", Version: 2}
		return nil
	})

	bus.AddHandler("test", func(cmd *alerting.UpdateDashboardAlertsCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func postDashboardScenario(desc string, url string, routePattern string, role m.RoleType, cmd m.SaveDashboardCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := &scenarioContext{
			url: url,
		}
		viewsPath, _ := filepath.Abs("../../public/views")

		sc.m = macaron.New()
		sc.m.Use(macaron.Renderer(macaron.RenderOptions{
			Directory: viewsPath,
			Delims:    macaron.Delims{Left: "[[", Right: "]]"},
		}))

		sc.m.Use(middleware.GetContextHandler())
		sc.m.Use(middleware.Sessioner(&session.Options{}))

		sc.defaultHandler = wrap(func(c *middleware.Context) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			return PostDashboard(c, cmd)
		})

		fakeRepo = &fakeDashboardRepo{}
		dashboards.SetRepository(fakeRepo)

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
