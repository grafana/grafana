package api

import (
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"

	. "github.com/smartystreets/goconvey/convey"
)

func TestAdminApiEndpoint(t *testing.T) {
	role := m.ROLE_ADMIN
	Convey("Given a server admin attempts to remove themself as an admin", t, func() {

		updateCmd := dtos.AdminUpdateUserPermissionsForm{
			IsGrafanaAdmin: false,
		}

		bus.AddHandler("test", func(cmd *m.UpdateUserPermissionsCommand) error {
			return m.ErrLastGrafanaAdmin
		})

		putAdminScenario("When calling PUT on", "/api/admin/users/1/permissions", "/api/admin/users/:id/permissions", role, updateCmd, func(sc *scenarioContext) {
			sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()
			So(sc.resp.Code, ShouldEqual, 400)
		})
	})
}

func putAdminScenario(desc string, url string, routePattern string, role m.RoleType, cmd dtos.AdminUpdateUserPermissionsForm, fn scenarioFunc) {
	Convey(desc+" "+url, func() {
		defer bus.ClearBusHandlers()

		sc := setupScenarioContext(url)
		sc.defaultHandler = Wrap(func(c *m.ReqContext) {
			sc.context = c
			sc.context.UserId = TestUserID
			sc.context.OrgId = TestOrgID
			sc.context.OrgRole = role

			AdminUpdateUserPermissions(c, cmd)
		})

		sc.m.Put(routePattern, sc.defaultHandler)

		fn(sc)
	})
}
