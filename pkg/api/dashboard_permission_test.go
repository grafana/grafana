package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/setting"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardPermissionApiEndpoint(t *testing.T) {
	Convey("Dashboard permissions test", t, func() {
		settings := setting.NewCfg()
		hs := &HTTPServer{Cfg: settings}

		Convey("Given dashboard not exists", func() {
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				return models.ErrDashboardNotFound
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/permissions", "/api/dashboards/id/:id/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
				callGetDashboardPermissions(sc, hs)
				So(sc.resp.Code, ShouldEqual, 404)
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:id/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(sc)
					So(sc.resp.Code, ShouldEqual, 404)
				},
			}, hs)
		})

		Convey("Given user has no admin permissions", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})

			getDashboardQueryResult := models.NewDashboard("Dash")
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = getDashboardQueryResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/permissions", "/api/dashboards/id/:id/permissions", models.ROLE_EDITOR, func(sc *scenarioContext) {
				callGetDashboardPermissions(sc, hs)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:id/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(sc)
					So(sc.resp.Code, ShouldEqual, 403)
				},
			}, hs)

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("Given user has admin permissions and permissions to update", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
				CanAdminValue:                    true,
				CheckPermissionBeforeUpdateValue: true,
				GetAclValue: []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 1, UserId: 2, Permission: models.PERMISSION_VIEW},
					{OrgId: 1, DashboardId: 1, UserId: 3, Permission: models.PERMISSION_EDIT},
					{OrgId: 1, DashboardId: 1, UserId: 4, Permission: models.PERMISSION_ADMIN},
					{OrgId: 1, DashboardId: 1, TeamId: 1, Permission: models.PERMISSION_VIEW},
					{OrgId: 1, DashboardId: 1, TeamId: 2, Permission: models.PERMISSION_ADMIN},
				},
			})

			getDashboardQueryResult := models.NewDashboard("Dash")
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = getDashboardQueryResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/permissions", "/api/dashboards/id/:id/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
				callGetDashboardPermissions(sc, hs)
				So(sc.resp.Code, ShouldEqual, 200)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(len(respJSON.MustArray()), ShouldEqual, 5)
				So(respJSON.GetIndex(0).Get("userId").MustInt(), ShouldEqual, 2)
				So(respJSON.GetIndex(0).Get("permission").MustInt(), ShouldEqual, models.PERMISSION_VIEW)
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:id/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(sc)
					So(sc.resp.Code, ShouldEqual, 200)
				},
			}, hs)

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("When trying to update permissions with duplicate permissions", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
				CanAdminValue:                    true,
				CheckPermissionBeforeUpdateValue: false,
				CheckPermissionBeforeUpdateError: guardian.ErrGuardianPermissionExists,
			})

			getDashboardQueryResult := models.NewDashboard("Dash")
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = getDashboardQueryResult
				return nil
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:id/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(sc)
					So(sc.resp.Code, ShouldEqual, 400)
				},
			}, hs)

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("When trying to override inherited permissions with lower precedence", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
				CanAdminValue:                    true,
				CheckPermissionBeforeUpdateValue: false,
				CheckPermissionBeforeUpdateError: guardian.ErrGuardianOverride},
			)

			getDashboardQueryResult := models.NewDashboard("Dash")
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = getDashboardQueryResult
				return nil
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: models.PERMISSION_ADMIN},
				},
			}

			updateDashboardPermissionScenario(updatePermissionContext{
				desc:         "When calling POST on",
				url:          "/api/dashboards/id/1/permissions",
				routePattern: "/api/dashboards/id/:id/permissions",
				cmd:          cmd,
				fn: func(sc *scenarioContext) {
					callUpdateDashboardPermissions(sc)
					So(sc.resp.Code, ShouldEqual, 400)
				},
			}, hs)

			Reset(func() {
				guardian.New = origNewGuardian
			})
		})

		Convey("Getting dashboard permissions without hidden users (except for signed in user)", func() {
			settings.HiddenUsers = map[string]struct{}{
				"hiddenUser":  {},
				TestUserLogin: {},
			}
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{
				CanAdminValue:                    true,
				CheckPermissionBeforeUpdateValue: true,
				GetAclValue: []*models.DashboardAclInfoDTO{
					{OrgId: 1, DashboardId: 1, UserId: 2, UserLogin: "hiddenUser", Permission: models.PERMISSION_VIEW},
					{OrgId: 1, DashboardId: 1, UserId: 3, UserLogin: TestUserLogin, Permission: models.PERMISSION_EDIT},
					{OrgId: 1, DashboardId: 1, UserId: 4, UserLogin: "user_1", Permission: models.PERMISSION_ADMIN},
				},
			})

			getDashboardQueryResult := models.NewDashboard("Dash")
			bus.AddHandler("test", func(query *models.GetDashboardQuery) error {
				query.Result = getDashboardQueryResult
				return nil
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/permissions", "/api/dashboards/id/:id/permissions", models.ROLE_ADMIN, func(sc *scenarioContext) {
				callGetDashboardPermissions(sc, hs)
				So(sc.resp.Code, ShouldEqual, 200)
				respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
				So(err, ShouldBeNil)
				So(len(respJSON.MustArray()), ShouldEqual, 2)
				So(respJSON.GetIndex(0).Get("userId").MustInt(), ShouldEqual, 3)
				So(respJSON.GetIndex(0).Get("permission").MustInt(), ShouldEqual, models.PERMISSION_EDIT)
				So(respJSON.GetIndex(1).Get("userId").MustInt(), ShouldEqual, 4)
				So(respJSON.GetIndex(1).Get("permission").MustInt(), ShouldEqual, models.PERMISSION_ADMIN)
			})

			Reset(func() {
				guardian.New = origNewGuardian
				settings.HiddenUsers = make(map[string]struct{})
			})
		})
	})
}

func callGetDashboardPermissions(sc *scenarioContext, hs *HTTPServer) {
	sc.handlerFunc = hs.GetDashboardPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateDashboardPermissions(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *models.UpdateDashboardAclCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

type updatePermissionContext struct {
	desc         string
	url          string
	routePattern string
	cmd          dtos.UpdateDashboardAclCommand
	fn           scenarioFunc
}

func updateDashboardPermissionScenario(ctx updatePermissionContext, hs *HTTPServer) {
	Convey(ctx.desc+" "+ctx.url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(ctx.url)

		sc.defaultHandler = Wrap(func(c *models.ReqContext) Response {
			sc.context = c
			sc.context.OrgId = TestOrgID
			sc.context.UserId = TestUserID

			return hs.UpdateDashboardPermissions(c, ctx.cmd)
		})

		sc.m.Post(ctx.routePattern, sc.defaultHandler)

		ctx.fn(sc)
	})
}
