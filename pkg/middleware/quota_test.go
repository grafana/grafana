package middleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMiddlewareQuota(t *testing.T) {
	Convey("Given the grafana quota middleware", t, func() {
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

		fakeAuthTokenService := auth.NewFakeUserAuthTokenService()
		qs := &quota.QuotaService{
			AuthTokenService: fakeAuthTokenService,
		}
		QuotaFn := Quota(qs)

		middlewareScenario(t, "with user not logged in", func(sc *scenarioContext) {
			bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
				query.Result = &models.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			Convey("global quota not reached", func() {
				sc.m.Get("/user", QuotaFn("user"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("global quota reached", func() {
				setting.Quota.Global.User = 4
				sc.m.Get("/user", QuotaFn("user"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})

			Convey("global session quota not reached", func() {
				setting.Quota.Global.Session = 10
				sc.m.Get("/user", QuotaFn("session"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("global session quota reached", func() {
				setting.Quota.Global.Session = 1
				sc.m.Get("/user", QuotaFn("session"), sc.defaultHandler)
				sc.fakeReq("GET", "/user").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})
		})

		middlewareScenario(t, "with user logged in", func(sc *scenarioContext) {
			sc.withTokenSessionCookie("token")
			bus.AddHandler("test", func(query *models.GetSignedInUserQuery) error {
				query.Result = &models.SignedInUser{OrgId: 2, UserId: 12}
				return nil
			})

			sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*models.UserToken, error) {
				return &models.UserToken{
					UserId:        12,
					UnhashedToken: "",
				}, nil
			}

			bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
				query.Result = &models.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			bus.AddHandler("userQuota", func(query *models.GetUserQuotaByTargetQuery) error {
				query.Result = &models.UserQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			bus.AddHandler("orgQuota", func(query *models.GetOrgQuotaByTargetQuery) error {
				query.Result = &models.OrgQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			Convey("global datasource quota reached", func() {
				setting.Quota.Global.DataSource = 4
				sc.m.Get("/ds", QuotaFn("data_source"), sc.defaultHandler)
				sc.fakeReq("GET", "/ds").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})

			Convey("user Org quota not reached", func() {
				setting.Quota.User.Org = 5
				sc.m.Get("/org", QuotaFn("org"), sc.defaultHandler)
				sc.fakeReq("GET", "/org").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("user Org quota reached", func() {
				setting.Quota.User.Org = 4
				sc.m.Get("/org", QuotaFn("org"), sc.defaultHandler)
				sc.fakeReq("GET", "/org").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})

			Convey("org dashboard quota not reached", func() {
				setting.Quota.Org.Dashboard = 10
				sc.m.Get("/dashboard", QuotaFn("dashboard"), sc.defaultHandler)
				sc.fakeReq("GET", "/dashboard").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})

			Convey("org dashboard quota reached", func() {
				setting.Quota.Org.Dashboard = 4
				sc.m.Get("/dashboard", QuotaFn("dashboard"), sc.defaultHandler)
				sc.fakeReq("GET", "/dashboard").exec()
				So(sc.resp.Code, ShouldEqual, 403)
			})

			Convey("org dashboard quota reached but quotas disabled", func() {
				setting.Quota.Org.Dashboard = 4
				setting.Quota.Enabled = false
				sc.m.Get("/dashboard", QuotaFn("dashboard"), sc.defaultHandler)
				sc.fakeReq("GET", "/dashboard").exec()
				So(sc.resp.Code, ShouldEqual, 200)
			})
		})
	})
}
