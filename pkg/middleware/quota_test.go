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
)

func TestMiddlewareQuota(t *testing.T) {
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
	quotaFn := Quota(qs)

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

			sc.m.Get("/user", quotaFn("user"), sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 200, sc.resp.Code)
		})

		middlewareScenario(t, "and global quota reached", func(t *testing.T, sc *scenarioContext) {
			bus.AddHandler("globalQuota", func(query *models.GetGlobalQuotaByTargetQuery) error {
				query.Result = &models.GlobalQuotaDTO{
					Target: query.Target,
					Limit:  query.Default,
					Used:   4,
				}
				return nil
			})

			origUser := setting.Quota.Global.User
			t.Cleanup(func() {
				setting.Quota.Global.User = origUser
			})
			setting.Quota.Global.User = 4

			sc.m.Get("/user", quotaFn("user"), sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 403, sc.resp.Code)
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

			origSession := setting.Quota.Global.Session
			t.Cleanup(func() {
				setting.Quota.Global.Session = origSession
			})
			setting.Quota.Global.Session = 10

			sc.m.Get("/user", quotaFn("session"), sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 200, sc.resp.Code)
		})

		middlewareScenario(t, "and global session quota reached", func(t *testing.T, sc *scenarioContext) {
			origSession := setting.Quota.Global.Session
			t.Cleanup(func() {
				setting.Quota.Global.Session = origSession
			})
			setting.Quota.Global.Session = 1

			sc.m.Get("/user", quotaFn("session"), sc.defaultHandler)
			sc.fakeReq("GET", "/user").exec()
			assert.Equal(t, 403, sc.resp.Code)
		})
	})

	middlewareScenario(t, "with user logged in", func(t *testing.T, sc *scenarioContext) {
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

		t.Run("global datasource quota reached", func(t *testing.T) {
			setting.Quota.Global.DataSource = 4
			sc.m.Get("/ds", quotaFn("data_source"), sc.defaultHandler)
			sc.fakeReq("GET", "/ds").exec()
			assert.Equal(t, 403, sc.resp.Code)
		})

		t.Run("user Org quota not reached", func(t *testing.T) {
			setting.Quota.User.Org = 5
			sc.m.Get("/org", quotaFn("org"), sc.defaultHandler)
			sc.fakeReq("GET", "/org").exec()
			assert.Equal(t, 200, sc.resp.Code)
		})

		t.Run("user Org quota reached", func(t *testing.T) {
			setting.Quota.User.Org = 4
			sc.m.Get("/org", quotaFn("org"), sc.defaultHandler)
			sc.fakeReq("GET", "/org").exec()
			assert.Equal(t, 403, sc.resp.Code)
		})

		t.Run("org dashboard quota not reached", func(t *testing.T) {
			setting.Quota.Org.Dashboard = 10
			sc.m.Get("/dashboard", quotaFn("dashboard"), sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 200, sc.resp.Code)
		})

		t.Run("org dashboard quota reached", func(t *testing.T) {
			setting.Quota.Org.Dashboard = 4
			sc.m.Get("/dashboard", quotaFn("dashboard"), sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 403, sc.resp.Code)
		})

		t.Run("org dashboard quota reached but quotas disabled", func(t *testing.T) {
			setting.Quota.Org.Dashboard = 4
			setting.Quota.Enabled = false
			sc.m.Get("/dashboard", quotaFn("dashboard"), sc.defaultHandler)
			sc.fakeReq("GET", "/dashboard").exec()
			assert.Equal(t, 200, sc.resp.Code)
		})
	})
}
