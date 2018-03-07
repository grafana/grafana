package middleware

import (
	"testing"

	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	. "github.com/smartystreets/goconvey/convey"
)

func TestOrgRedirectMiddleware(t *testing.T) {

	Convey("Can redirect to correct org", t, func() {
		middlewareScenario("when setting a correct org for the user", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").handler(func(c *m.ReqContext) {
				c.Session.Set(session.SESS_KEY_USERID, int64(12))
			}).exec()

			bus.AddHandler("test", func(query *m.SetUsingOrgCommand) error {
				return nil
			})

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 1, UserId: 12}
				return nil
			})

			sc.m.Get("/", sc.defaultHandler)
			sc.fakeReq("GET", "/?orgId=3").exec()

			Convey("change org and redirect", func() {
				So(sc.resp.Code, ShouldEqual, 302)
			})
		})

		middlewareScenario("when setting an invalid org for user", func(sc *scenarioContext) {
			sc.fakeReq("GET", "/").handler(func(c *m.ReqContext) {
				c.Session.Set(session.SESS_KEY_USERID, int64(12))
			}).exec()

			bus.AddHandler("test", func(query *m.SetUsingOrgCommand) error {
				return fmt.Errorf("")
			})

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 1, UserId: 12}
				return nil
			})

			sc.m.Get("/", sc.defaultHandler)
			sc.fakeReq("GET", "/?orgId=3").exec()

			Convey("not allowed to change org", func() {
				So(sc.resp.Code, ShouldEqual, 404)
			})
		})
	})
}
