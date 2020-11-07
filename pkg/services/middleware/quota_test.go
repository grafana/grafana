package middleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestMiddlewareQuota(t *testing.T) {
	middlewareScenario(t, "with user not logged in", func(t *testing.T, sc *scenarioContext) {
		quotaFn := Quota(&quota.QuotaService{
			AuthTokenService: sc.userAuthTokenService,
			Cfg:              sc.service.Cfg,
		})

		sc.service.Cfg.AnonymousEnabled = false
		sc.service.Cfg.Quota = setting.QuotaSettings{
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

		bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
			query.Result = &models.GlobalQuotaDTO{
				Target: query.Target,
				Limit:  query.Default,
				Used:   4,
			}
			return nil
		})

		// global quota not reached"
		sc.m.Get("/user", quotaFn("user"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/user").exec(t)
		assert.Equal(t, 200, sc.resp.Code)

		// global quota reached
		sc.service.Cfg.Quota.Global.User = 4
		sc.m.Get("/user", quotaFn("user"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/user").exec(t)
		assert.Equal(t, 403, sc.resp.Code)

		// global session quota not reached
		sc.service.Cfg.Quota.Global.Session = 10
		sc.m.Get("/user", quotaFn("session"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/user").exec(t)
		assert.Equal(t, 200, sc.resp.Code)

		// global session quota reached
		sc.service.Cfg.Quota.Global.Session = 1
		sc.m.Get("/user", quotaFn("session"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/user").exec(t)
		assert.Equal(t, 403, sc.resp.Code)
	})

	middlewareScenario(t, "with user logged in", func(t *testing.T, sc *scenarioContext) {
		quotaFn := Quota(&quota.QuotaService{
			AuthTokenService: sc.userAuthTokenService,
			Cfg:              sc.service.Cfg,
		})

		sc.service.Cfg.AnonymousEnabled = false
		sc.service.Cfg.Quota = setting.QuotaSettings{
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

		// global datasource quota reached
		sc.service.Cfg.Quota.Global.DataSource = 4
		sc.m.Get("/ds", quotaFn("data_source"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/ds").exec(t)
		assert.Equal(t, 403, sc.resp.Code)

		// user Org quota not reached"
		sc.service.Cfg.Quota.User.Org = 5
		sc.m.Get("/org", quotaFn("org"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/org").exec(t)
		assert.Equal(t, 200, sc.resp.Code)

		// user Org quota reache
		sc.service.Cfg.Quota.User.Org = 4
		sc.m.Get("/org", quotaFn("org"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/org").exec(t)
		assert.Equal(t, 403, sc.resp.Code)

		// org dashboard quota not reached
		sc.service.Cfg.Quota.Org.Dashboard = 10
		sc.m.Get("/dashboard", quotaFn("dashboard"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/dashboard").exec(t)
		assert.Equal(t, 200, sc.resp.Code)

		// org dashboard quota reached
		sc.service.Cfg.Quota.Org.Dashboard = 4
		sc.m.Get("/dashboard", quotaFn("dashboard"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/dashboard").exec(t)
		assert.Equal(t, 403, sc.resp.Code)

		// org dashboard quota reached but quotas disabled
		sc.service.Cfg.Quota.Org.Dashboard = 4
		sc.service.Cfg.Quota.Enabled = false
		sc.m.Get("/dashboard", quotaFn("dashboard"), sc.defaultHandler)
		sc.fakeReq(t, "GET", "/dashboard").exec(t)
		assert.Equal(t, 200, sc.resp.Code)
	})
}
