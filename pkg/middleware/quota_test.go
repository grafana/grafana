package middleware

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestMiddlewareQuota(t *testing.T) {
	t.Run("With user not logged in", func(t *testing.T) {
		middlewareScenario(t, "and global quota not reached", func(t *testing.T, sc *scenarioContext) {
			quotaHandler := getQuotaHandler(false, "user")

			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, configure)

		middlewareScenario(t, "and global quota reached", func(t *testing.T, sc *scenarioContext) {
			quotaHandler := getQuotaHandler(true, "user")
			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "and global session quota not reached", func(t *testing.T, sc *scenarioContext) {
			quotaHandler := getQuotaHandler(false, "session")
			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "and global session quota reached", func(t *testing.T, sc *scenarioContext) {
			quotaHandler := getQuotaHandler(true, "session")
			sc.m.Get("/user", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})
	})

	t.Run("with user logged in", func(t *testing.T) {
		setUp := func(sc *scenarioContext) {
			sc.withTokenSessionCookie("token")
			sc.userService.ExpectedSignedInUser = &user.SignedInUser{UserID: 12}
			sc.userAuthTokenService.LookupTokenProvider = func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
				return &auth.UserToken{
					UserId:        12,
					UnhashedToken: "",
				}, nil
			}
		}

		middlewareScenario(t, "global datasource quota reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(true, "data_source")
			sc.m.Get("/ds", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/ds").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "user Org quota not reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(false, "org")

			sc.m.Get("/org", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/org").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "user Org quota reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(true, "org")
			sc.m.Get("/org", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/org").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "org dashboard quota not reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(false, "dashboard")
			sc.m.Get("/dashboard", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "org dashboard quota reached", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(true, "dashboard")
			sc.m.Get("/dashboard", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "org dashboard quota reached, but quotas disabled", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(false, "dashboard")
			sc.m.Get("/dashboard", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "org alert quota reached and unified alerting is enabled", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(true, "alert_rule")
			sc.m.Get("/alert_rule", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/alert_rule").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.UnifiedAlerting.Enabled = new(bool)
			*cfg.UnifiedAlerting.Enabled = true
		})

		middlewareScenario(t, "org alert quota not reached and unified alerting is enabled", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(false, "alert_rule")
			sc.m.Get("/alert_rule", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/alert_rule").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)

			cfg.UnifiedAlerting.Enabled = new(bool)
			*cfg.UnifiedAlerting.Enabled = true
		})

		middlewareScenario(t, "org alert quota reached but ngalert disabled", func(t *testing.T, sc *scenarioContext) {
			// this scenario can only happen if the feature was enabled and later disabled
			setUp(sc)

			quotaHandler := getQuotaHandler(true, "alert_rule")
			sc.m.Get("/alert_rule", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/alert_rule").exec()
			assert.Equal(t, 403, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})

		middlewareScenario(t, "org alert quota not reached but ngalert disabled", func(t *testing.T, sc *scenarioContext) {
			setUp(sc)

			quotaHandler := getQuotaHandler(false, "alert_rule")
			sc.m.Get("/alert_rule", quotaHandler, sc.defaultHandler)
			sc.fakeReq("GET", "/alert_rule").exec()
			assert.Equal(t, 200, sc.resp.Code)
		}, func(cfg *setting.Cfg) {
			configure(cfg)
		})
	})
}

func getQuotaHandler(reached bool, target string) web.Handler {
	qs := quotatest.New(reached, nil)
	return Quota(qs)(target)
}

func configure(cfg *setting.Cfg) {
	cfg.AnonymousEnabled = false
}
