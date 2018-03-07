package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAlertingApiEndpoint(t *testing.T) {
	Convey("Given an alert in a dashboard with an acl", t, func() {

		singleAlert := &m.Alert{Id: 1, DashboardId: 1, Name: "singlealert"}

		bus.AddHandler("test", func(query *m.GetAlertByIdQuery) error {
			query.Result = singleAlert
			return nil
		})

		viewerRole := m.ROLE_VIEWER
		editorRole := m.ROLE_EDITOR

		aclMockResp := []*m.DashboardAclInfoDTO{}
		bus.AddHandler("test", func(query *m.GetDashboardAclInfoListQuery) error {
			query.Result = aclMockResp
			return nil
		})

		bus.AddHandler("test", func(query *m.GetTeamsByUserQuery) error {
			query.Result = []*m.Team{}
			return nil
		})

		Convey("When user is editor and not in the ACL", func() {
			Convey("Should not be able to pause the alert", func() {
				cmd := dtos.PauseAlertCommand{
					AlertId: 1,
					Paused:  true,
				}
				postAlertScenario("When calling POST on", "/api/alerts/1/pause", "/api/alerts/:alertId/pause", m.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
					CallPauseAlert(sc)
					So(sc.resp.Code, ShouldEqual, 403)
				})
			})
		})

		Convey("When user is editor and dashboard has default ACL", func() {
			aclMockResp = []*m.DashboardAclInfoDTO{
				{Role: &viewerRole, Permission: m.PERMISSION_VIEW},
				{Role: &editorRole, Permission: m.PERMISSION_EDIT},
			}

			Convey("Should be able to pause the alert", func() {
				cmd := dtos.PauseAlertCommand{
					AlertId: 1,
					Paused:  true,
				}
				postAlertScenario("When calling POST on", "/api/alerts/1/pause", "/api/alerts/:alertId/pause", m.ROLE_EDITOR, cmd, func(sc *scenarioContext) {
					CallPauseAlert(sc)
					So(sc.resp.Code, ShouldEqual, 200)
				})
			})
		})
	})
}

func CallPauseAlert(sc *scenarioContext) {
	bus.AddHandler("test", func(cmd *m.PauseAlertCommand) error {
		return nil
	})

	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func postAlertScenario(desc string, url string, routePattern string, role m.RoleType, cmd dtos.PauseAlertCommand, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = wrap(func(c *m.ReqContext) Response {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			return PauseAlert(c, cmd)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
