package middleware

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	macaron "gopkg.in/macaron.v1"
)

func TestMiddlewareQuota(t *testing.T) {
	t.Run("With user not logged in", func(t *testing.T) {
		middlewareScenario(t, "and global quota not reached", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
				query.Result = &models.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			quotaHandler := getQuotaHandler(sc, "user")

			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, configure)

		middlewareScenario(t, "and global quota reached", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
				query.Result = &models.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			quotaHandler := getQuotaHandler(sc, "user")
			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Global.User = 4
		})

		middlewareScenario(t, "and global session quota not reached", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
				query.Result = &models.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			quotaHandler := getQuotaHandler(sc, "session")
			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Global.Session = 10
		})

		middlewareScenario(t, "and global session quota reached", func(t *testing.T, sc *scenarioContext) {
			quotaHandler := getQuotaHandler(sc, "session")
			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Global.Session = 1
		})
	})

	t.Run("with user logged in", func(t *testing.T) {
		const quotaUsed = 4

		setUp := func(sc *scenarioContext) {
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
					Used:   quotaUsed,
				}
				return nil
			})

			bus.AddHandler("userQuota", func(query *models.GetUserQuotaByTargetQuery) error {
				query.Result = &models.UserQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   quotaUsed,
				}
				return nil
			})

			bus.AddHandler("orgQuota", func(query *models.GetOrgQuotaByTargetQuery) error {
				query.Result = &models.OrgQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   quotaUsed,
				}
				return nil
			})
		}

		middlewareScenario(t, "global datasource quota reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(sc, "data_source")
			sc.m.Get("/ds", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/ds").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Global.DataSource = quotaUsed
		})

		middlewareScenario(t, "user Org quota not reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(sc, "org")

			sc.m.Get("/org", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/org").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.User.Org = quotaUsed + 1
		})

		middlewareScenario(t, "user Org quota reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(sc, "org")
			sc.m.Get("/org", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/org").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.User.Org = quotaUsed
		})

		middlewareScenario(t, "org dashboard quota not reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(sc, "dashboard")
			sc.m.Get("/dashboard", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Org.Dashboard = quotaUsed + 1
		})

		middlewareScenario(t, "org dashboard quota reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(sc, "dashboard")
			sc.m.Get("/dashboard", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Org.Dashboard = quotaUsed
		})

		middlewareScenario(t, "org dashboard quota reached, but quotas disabled", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(sc, "dashboard")
			sc.m.Get("/dashboard", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.Quota.Org.Dashboard = quotaUsed
			cfg.Quota.Enabled = false
		})
	})
}

func getQuotaHandler(sc *scenarioContext, target string) macaron.Handler {
	fakeAuthTokenService := auth.NewFakeUserAuthTokenService()
	qs := &quota.QuotaService{
		AuthTokenService: fakeAuthTokenService,
		Cfg:              sc.cfg,
	}

	return Quota(qs)(target)
}

func configure(cfg *setting.Cfg) {
	cfg.AnonymousEnabled = false
	cfg.Quota = setting.QuotaSettings{
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
}
