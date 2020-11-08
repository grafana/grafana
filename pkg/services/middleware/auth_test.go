package middleware

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestMiddlewareAuth(t *testing.T) {
	reqSignIn := middleware.Auth(&middleware.AuthOptions{ReqSignedIn: true})

	middlewareScenario(t, "ReqSignIn true and unauthenticated request", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

		sc.fakeReq(t, "GET", "/secure").exec(t)

		assert.Equal(t, 302, sc.resp.Code)
	})

	middlewareScenario(t, "ReqSignIn true and unauthenticated API request", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/api/secure", reqSignIn, sc.defaultHandler)

		sc.fakeReq(t, "GET", "/api/secure").exec(t)

		assert.Equal(t, 401, sc.resp.Code)
	})

	middlewareScenario(t, "Anonymous auth enabled", func(t *testing.T, sc *scenarioContext) {
		sc.service.Cfg.AnonymousEnabled = true
		sc.service.Cfg.AnonymousOrgName = "test"

		sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

		bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
			query.Result = &models.Org{Id: 1, Name: "test"}
			return nil
		})

		t.Run("ReqSignIn true and request with forceLogin in query string", func(t *testing.T) {
			sc.fakeReq(t, "GET", "/secure?forceLogin=true").exec(t)

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		})

		t.Run("ReqSignIn true and request with same org provided in query string", func(t *testing.T) {
			sc.fakeReq(t, "GET", "/secure?orgId=1").exec(t)

			assert.Equal(t, 200, sc.resp.Code)
		})

		t.Run("ReqSignIn true and request with different org provided in query string", func(t *testing.T) {
			sc.fakeReq(t, "GET", "/secure?orgId=2").exec(t)

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		})
	})

	middlewareScenario(t, "Snapshot public mode disabled and unauthenticated request should return 401", func(
		t *testing.T, sc *scenarioContext) {
		sc.m.Get("/api/snapshot", sc.service.SnapshotPublicModeOrSignedIn, sc.defaultHandler)
		sc.fakeReq(t, "GET", "/api/snapshot").exec(t)
		assert.Equal(t, 401, sc.resp.Code)
	})

	middlewareScenario(t, "Snapshot public mode enabled and unauthenticated request should return 200", func(
		t *testing.T, sc *scenarioContext) {
		cfg := setting.NewCfg()
		cfg.SnapshotPublicMode = true
		svc := &MiddlewareService{
			Cfg: cfg,
		}

		sc.m.Get("/api/snapshot", svc.SnapshotPublicModeOrSignedIn, sc.defaultHandler)
		sc.fakeReq(t, "GET", "/api/snapshot").exec(t)
		assert.Equal(t, 200, sc.resp.Code)
	})
}
