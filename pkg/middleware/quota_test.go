package middleware

import (
	"testing"

	"github.com/wangy1931/grafana/pkg/bus"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareQuota(t *testing.T) {

	Convey("Given the grafana quota middleware", t, func() {
		getSessionCount = func() int {
			return 4
		}

		setting.AnonymousEnabled = false
		setting.Quota = setting.QuotaSettings{
			Enabled: true,
			Org: &setting.OrgQuota{
				User:       5,
				Dashboard:  5,
				DataSource: 5,
				ApiKey:     5,
			},
			User: &setting.UserQuota{
				Org: 5,
			},
			Global: &setting.GlobalQuota{
				Org:        5,
				User:       5,
				Dashboard:  5,
				DataSource: 5,
				ApiKey:     5,
				Session:    5,
			},
		}

		middlewareScenario("with user not logged in", func(sc *scenarioContext) {
			bus.AddHandler("globalQuota", func(query *m.GetGlobalQuotaByTargetQuery) error {
				query.Result = &m.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})
			Convey("global quota not reached", func() {
				sc.m.Get("/user", Quota("user"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})
			Convey("global quota reached", func() {
				setting.Quota.Global.User = 4
				sc.m.Get("/user", Quota("user"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})
			Convey("global session quota not reached", func() {
				setting.Quota.Global.Session = 10
				sc.m.Get("/user", Quota("session"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})
			Convey("global session quota reached", func() {
				setting.Quota.Global.Session = 1
				sc.m.Get("/user", Quota("session"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		middlewareScenario("with user logged in", func(sc *scenarioContext) {
			// log us in, so we have a user_id and org_id in the context
			sc.fakeReq("GET", "/").handler(func(c *Context) {
				c.Session.Set(SESS_KEY_USERID, int64(12))
			}).exec()

			bus.AddHandler("test", func(query *m.GetSignedInUserQuery) error {
				query.Result = &m.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})
			bus.AddHandler("globalQuota", func(query *m.GetGlobalQuotaByTargetQuery) error {
				query.Result = &m.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})
			bus.AddHandler("userQuota", func(query *m.GetUserQuotaByTargetQuery) error {
				query.Result = &m.UserQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})
			bus.AddHandler("orgQuota", func(query *m.GetOrgQuotaByTargetQuery) error {
				query.Result = &m.OrgQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})
			Convey("global datasource quota reached", func() {
				setting.Quota.Global.DataSource = 4
				sc.m.Get("/ds", Quota("data_source"), sc.defaultHandler)
				sc.fakeReq("GET", "/ds").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})
			Convey("user Org quota not reached", func() {
				setting.Quota.User.Org = 5
				sc.m.Get("/org", Quota("org"), sc.defaultHandler)
				sc.fakeReq("GET", "/org").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})
			Convey("user Org quota reached", func() {
				setting.Quota.User.Org = 4
				sc.m.Get("/org", Quota("org"), sc.defaultHandler)
				sc.fakeReq("GET", "/org").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})
			Convey("org dashboard quota not reached", func() {
				setting.Quota.Org.Dashboard = 10
				sc.m.Get("/dashboard", Quota("dashboard"), sc.defaultHandler)
				sc.fakeReq("GET", "/dashboard").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})
			Convey("org dashboard quota reached", func() {
				setting.Quota.Org.Dashboard = 4
				sc.m.Get("/dashboard", Quota("dashboard"), sc.defaultHandler)
				sc.fakeReq("GET", "/dashboard").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})
			Convey("org dashboard quota reached but quotas disabled", func() {
				setting.Quota.Org.Dashboard = 4
				setting.Quota.Enabled = false
				sc.m.Get("/dashboard", Quota("dashboard"), sc.defaultHandler)
				sc.fakeReq("GET", "/dashboard").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})

		})

	})
}
