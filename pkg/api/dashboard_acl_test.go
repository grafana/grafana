package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestDashboardAclApiEndpoint(t *testing.T) {
	Convey("Given a dashboard acl", t, func() {
		mockResult := []*models.DashboardAcl{
			{Id: 1, OrgId: 1, DashboardId: 1, UserId: 2, Permissions: models.PERMISSION_EDIT},
			{Id: 2, OrgId: 1, DashboardId: 1, UserId: 3, Permissions: models.PERMISSION_VIEW},
			{Id: 3, OrgId: 1, DashboardId: 1, UserGroupId: 1, Permissions: models.PERMISSION_EDIT},
			{Id: 4, OrgId: 1, DashboardId: 1, UserGroupId: 2, Permissions: models.PERMISSION_READ_ONLY_EDIT},
		}
		dtoRes := []*models.DashboardAclInfoDTO{
			{Id: 1, OrgId: 1, DashboardId: 1, UserId: 2, Permissions: models.PERMISSION_EDIT},
			{Id: 2, OrgId: 1, DashboardId: 1, UserId: 3, Permissions: models.PERMISSION_VIEW},
			{Id: 3, OrgId: 1, DashboardId: 1, UserGroupId: 1, Permissions: models.PERMISSION_EDIT},
			{Id: 4, OrgId: 1, DashboardId: 1, UserGroupId: 2, Permissions: models.PERMISSION_READ_ONLY_EDIT},
		}

		bus.AddHandler("test", func(query *models.GetDashboardAclInfoListQuery) error {
			query.Result = dtoRes
			return nil
		})

		bus.AddHandler("test", func(query *models.GetInheritedDashboardAclQuery) error {
			query.Result = mockResult
			return nil
		})

		userGroupResp := []*models.UserGroup{}
		bus.AddHandler("test", func(query *models.GetUserGroupsByUserQuery) error {
			query.Result = userGroupResp
			return nil
		})

		Convey("When user is org admin", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardsId/acl", models.ROLE_ADMIN, func(sc *scenarioContext) {
				Convey("Should be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)

					respJSON, err := simplejson.NewJson(sc.resp.Body.Bytes())
					So(err, ShouldBeNil)
					So(respJSON.GetIndex(0).Get("userId").MustInt(), ShouldEqual, 2)
					So(respJSON.GetIndex(0).Get("permissions").MustInt(), ShouldEqual, models.PERMISSION_EDIT)
				})
			})
		})

		Convey("When user is editor and in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardId/acl", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &models.DashboardAcl{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permissions: models.PERMISSION_EDIT})

				Convey("Should be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardId/acl/:aclId", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &models.DashboardAcl{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permissions: models.PERMISSION_EDIT})

				bus.AddHandler("test3", func(cmd *models.RemoveDashboardAclCommand) error {
					return nil
				})

				Convey("Should be able to delete permission", func() {
					sc.handlerFunc = DeleteDashboardAcl
					sc.fakeReqWithParams("DELETE", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 200)
				})
			})

			Convey("When user is a member of a user group in the ACL with edit permission", func() {
				loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/1", "/api/dashboards/id/:dashboardsId/acl/:aclId", models.ROLE_EDITOR, func(sc *scenarioContext) {
					userGroupResp = append(userGroupResp, &models.UserGroup{Id: 1, OrgId: 1, Name: "UG1"})

					bus.AddHandler("test3", func(cmd *models.RemoveDashboardAclCommand) error {
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

		Convey("When user is editor and not in the ACL", func() {
			loggedInUserScenarioWithRole("When calling GET on", "GET", "/api/dashboards/id/1/acl", "/api/dashboards/id/:dashboardsId/acl", models.ROLE_EDITOR, func(sc *scenarioContext) {

				Convey("Should not be able to access ACL", func() {
					sc.handlerFunc = GetDashboardAclList
					sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

					So(sc.resp.Code, ShouldEqual, 403)
				})
			})

			loggedInUserScenarioWithRole("When calling DELETE on", "DELETE", "/api/dashboards/id/1/acl/user/1", "/api/dashboards/id/:dashboardsId/acl/user/:userId", models.ROLE_EDITOR, func(sc *scenarioContext) {
				mockResult = append(mockResult, &models.DashboardAcl{Id: 1, OrgId: 1, DashboardId: 1, UserId: 1, Permissions: models.PERMISSION_VIEW})
				bus.AddHandler("test3", func(cmd *models.RemoveDashboardAclCommand) error {
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
