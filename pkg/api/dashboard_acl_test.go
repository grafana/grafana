package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
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
		})

		Convey("When user is editor and has admin permission in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

				Convey("Should be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardId/acl/:aclId", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_ADMIN})

				bus.AddHandler("test3", func(cmd *m.RemoveDashboardAclCommand) error {
					return nil
				})

				Convey("Should be able to delete permission", func() {
					sc.handlerFunc = DeleteDashboardAcl
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

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

		Convey("When user is editor and has edit permission in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", m.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &m.DashboardAclInfoDTO{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permission: m.PERMISSION_EDIT})

				Convey("Should not be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardId/acl/:aclId", m.ROLE_EDITOR, func(sc *scenarioContext) {
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

		Convey("When user is editor and not in the ACL", func() {
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
