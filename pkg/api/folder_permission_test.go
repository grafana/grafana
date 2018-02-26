package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/guardian"

	. "github.com/smartystreets/goconvey/convey"
)

func TestFolderPermissionApiEndpoint(t *testing.T) {
	Convey("Folder permissions test", t, func() {
		Convey("Given user has no admin permissions", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: false})

			mock := &fakeFolderService{
				GetFolderByUidResult: &m.Folder{
					Id:    1,
					Uid:   "uid",
					Title: "Folder",
				},
			}

			origNewFolderService := dashboards.NewFolderService
			mockFolderService(mock)

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", m.ROLE_EDITOR, func(sc *scenarioContext) {
				callGetFolderPermissions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: m.PERMISSION_ADMIN},
				},
			}

			updateFolderPermissionScenario("When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				So(sc.resp.Code, ShouldEqual, 403)
			})

			Reset(func() {
				guardian.New = origNewGuardian
				dashboards.NewFolderService = origNewFolderService
			})
		})

		Convey("Given user has admin permissions and permissions to update", func() {
			origNewGuardian := guardian.New
			guardian.MockDashboardGuardian(&guardian.FakeDashboardGuardian{CanAdminValue: true, CheckPermissionBeforeUpdateValue: true})

			mock := &fakeFolderService{
				GetFolderByUidResult: &m.Folder{
					Id:    1,
					Uid:   "uid",
					Title: "Folder",
				},
			}

			origNewFolderService := dashboards.NewFolderService
			mockFolderService(mock)

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", m.ROLE_ADMIN, func(sc *scenarioContext) {
				callGetFolderPermissions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			cmd := dtos.UpdateDashboardAclCommand{
				Items: []dtos.DashboardAclUpdateItem{
					{UserId: 1000, Permission: m.PERMISSION_ADMIN},
				},
			}

			updateFolderPermissionScenario("When calling POST on", "/api/folders/uid/permissions", "/api/folders/:uid/permissions", cmd, func(sc *scenarioContext) {
				callUpdateFolderPermissions(sc)
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Reset(func() {
				guardian.New = origNewGuardian
				dashboards.NewFolderService = origNewFolderService
			})
		})
	})
}

func callGetFolderPermissions(sc *scenarioContext) {
	sc.handlerFunc = GetFolderPermissionList
	sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()
}

func callUpdateFolderPermissions(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.UpdateDashboardAclCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func updateFolderPermissionScenario(desc string, url string, routePattern string, cmd dtos.UpdateDashboardAclCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)

		sc.defaultHandler = wrap(func(c *middleware.Context) Response {
			sc.context = c
			sc.context.OrgId = TestOrgID
			sc.context.UserId = TestUserID

			return UpdateFolderPermissions(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
