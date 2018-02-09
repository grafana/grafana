package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/middleware"
	m "github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardAclApiEndpoint(t *testing.T) {
	Convey("Given a dashboard acl", t, func() {
		mockResult := []*m.DashboardAclInfoDTO{
			{Id: 1, OrgId: 1, DashboardId: 1, UserId: 2, Permission: m.PERMISSION_VIEW},
			{Id: 2, OrgId: 1, DashboardId: 1, UserId: 3, Permission: m.PERMISSION_EDIT},
			{Id: 3, OrgId: 1, DashboardId: 1, UserId: 4, Permission: m.PERMISSION_ADMIN},
			{Id: 4, OrgId: 1, DashboardId: 1, TeamId: 1, Permission: m.PERMISSION_VIEW},
			{Id: 5, OrgId: 1, DashboardId: 1, TeamId: 2, Permission: m.PERMISSION_ADMIN},
		}
		dtoRes := transformDashboardAclsToDTOs(mockResult)

		getDashboardQueryResult := m.NewDashboard("Dash")
		var getDashboardNotFoundError error

		bus.AddHandler("test", func(query *m.GetDashboardQuery) error {
			query.Result = getDashboardQueryResult
			return getDashboardNotFoundError
		})

		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = dtoRes
			return nil
		})

		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = mockResult
			return nil
		})

		teamResp := []*m.Team{}
		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = teamResp
			return nil
		})

		// This tests four scenarios:
		// 1. user is an org admin
		// 2. user is an org editor AND has been granted admin permission for the dashboard
		// 3. user is an org viewer AND has been granted edit permission for the dashboard
		// 4. user is an org editor AND has no permissions for the dashboard

		Convey("When user is org admin", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardsId/acl", m.ROLE_ADMIN, func(sc *scenarioContext) {
				Convey("Should be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)

					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)
					So(len(respJSON.MustArray()), ShouldEqual, 5)
					So(respJSON.GetIndex(0).Get("userId").MustInt(), ShouldEqual, 2)
					So(respJSON.GetIndex(0).Get("permission").MustInt(), ShouldEqual, m.PERMISSION_VIEW)
				})
			})

			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/2/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_ADMIN, func(sc *scenarioContext) {
				getDashboardNotFoundError = m.ErrDashboardNotFound
				sc.handlerFunc = GetDashboardAclList
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				Convey("Should not be able to access ACL", func() {
					So(sc.resp.Code, ShouldEqual, 404)
				})
			})

			Convey("Should not be able to update permissions for non-existing dashboard", func() {
				cmd := dtos.UpdateDashboardAclCommand{
					Items: []dtos.DashboardAclUpdateItem{
						{UserId: 1000, Permission: m.PERMISSION_ADMIN},
					},
				}

				postAclScenario("When calling POST on", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_ADMIN, cmd, func(sc *scenarioContext) {
					getDashboardNotFoundError = m.ErrDashboardNotFound
					CallPostAcl(sc)
					So(sc.resp.Code, ShouldEqual, 404)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/2/acl/6", "/api/dashboards/id/:dashboardId/acl/:aclId", m.ROLE_ADMIN, func(sc *scenarioContext) {
				getDashboardNotFoundError = m.ErrDashboardNotFound
				sc.handlerFunc = DeleteDashboardAcl
				sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

				Convey("Should not be able to delete non-existing dashboard", func() {
					So(sc.resp.Code, ShouldEqual, 404)
				})
			})
		})

		Convey("When user is org editor and has admin permission in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 6, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

				Convey("Should be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardId/acl/:aclId", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 6, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

				bus.AddHandler("test3", func(cmd *m.RemoveDashboardAclCommand) error {
					return nil
				})

				Convey("Should be able to delete permission", func() {
					sc.handlerFunc = DeleteDashboardAcl
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/6", "/api/dashboards/id/:dashboardId/acl/:aclId", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 6, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

				bus.AddHandler("test3", func(cmd *m.RemoveDashboardAclCommand) error {
					return nil
				})

				Convey("Should not be able to delete their own Admin permission", func() {
					sc.handlerFunc = DeleteDashboardAcl
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			Convey("Should not be able to downgrade their own Admin permission", func() {
				cmd := dtos.UpdateDashboardAclCommand{
					Items: []dtos.DashboardAclUpdateItem{
						{UserId: TestUserID, Permission: m.PERMISSION_EDIT},
					},
				}

				postAclScenario("When calling POST on", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
					mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 6, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

					CallPostAcl(sc)
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			Convey("Should be able to update permissions", func() {
				cmd := dtos.UpdateDashboardAclCommand{
					Items: []dtos.DashboardAclUpdateItem{
						{UserId: TestUserID, Permission: m.PERMISSION_ADMIN},
						{UserId: 2, Permission: m.PERMISSION_EDIT},
					},
				}

				postAclScenario("When calling POST on", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
					mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 6, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

					CallPostAcl(sc)
					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			Convey("When user is a member of a team in the ACL with admin permission", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardsId/acl/:aclId", m.ROLE_EDITOR, func(sc *scenarioContext) {
					teamResp = append(teamResp, &m.Team{Id: 2, OrgId: 1, Name: "UG2"})

					bus.AddHandler("test3", func(cmd *m.RemoveDashboardAclCommand) error {
						return nil
					})

					Convey("Should be able to delete permission", func() {
						sc.handlerFunc = DeleteDashboardAcl
						sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

						So(sc.resp.Code, ShouldEqual, 200)
					})
				})
			})
		})

		Convey("When user is org viewer and has edit permission in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_VIEWER, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_EDIT})

				// Getting the permissions is an Admin permission
				Convey("Should not be able to get list of permissions from ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardId/acl/:aclId", m.ROLE_VIEWER, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_EDIT})

				bus.AddHandler("test3", func(cmd *m.RemoveDashboardAclCommand) error {
					return nil
				})

				Convey("Should be not be able to delete permission", func() {
					sc.handlerFunc = DeleteDashboardAcl
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})
		})

		Convey("When user is org editor and not in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardsId/acl", m.ROLE_EDITOR, func(sc *scenarioContext) {

				Convey("Should not be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/user/1", "/api/dashboards/id/:dashboardsId/acl/user/:userId", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_VIEW})
				bus.AddHandler("test3", func(cmd *m.RemoveDashboardAclCommand) error {
					return nil
				})

				Convey("Should be not be able to delete permission", func() {
					sc.handlerFunc = DeleteDashboardAcl
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})
		})
	})
}

func transformDashboardAclsToDTOs(acls []*m.DashboardAclInfoDTO) []*m.DashboardAclInfoDTO {
	dtos := make([]*m.DashboardAclInfoDTO, 0)

	for _, acl := range acls {
		dto := &m.DashboardAclInfoDTO{
			Id:          acl.Id,
			OrgId:       acl.OrgId,
			DashboardId: acl.DashboardId,
			Permission:  acl.Permission,
			UserId:      acl.UserId,
			TeamId:      acl.TeamId,
		}
		dtos = append(dtos, dto)
	}

	return dtos
}

func CallPostAcl(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.UpdateDashboardAclCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func postAclScenario(desc string, url string, routePattern string, role m.RoleType, cmd dtos.UpdateDashboardAclCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)

		sc.defaultHandler = wrap(func(c *middleware.Context) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			return UpdateDashboardAcl(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
