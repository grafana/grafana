package middleware

import (
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestMiddlewareAuth(t *testing.T) {
	reqSignIn := Auth(&AuthOptions{ReqSignedIn: true})

	middlewareScenario(t, "ReqSignIn true and unauthenticated request", func(sc *scenarioContext) {
		sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

		sc.fakeReq("GET", "/secure").exec()

		assert.Equal(t, 302, sc.resp.Code)
	})

	middlewareScenario(t, "ReqSignIn true and unauthenticated API request", func(sc *scenarioContext) {
		sc.m.Get("/api/secure", reqSignIn, sc.defaultHandler)

		sc.fakeReq("GET", "/api/secure").exec()

		assert.Equal(t, 401, sc.resp.Code)
	})

	t.Run("Anonymous auth enabled", func(t *testing.T) {
		origEnabled := setting.AnonymousEnabled
		t.Cleanup(func() {
			setting.AnonymousEnabled = origEnabled
		})
		origName := setting.AnonymousOrgName
		t.Cleanup(func() {
			setting.AnonymousOrgName = origName
		})
		setting.AnonymousEnabled = true
		setting.AnonymousOrgName = "test"

		bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
			query.Result = &models.Org{Id: 1, Name: "test"}
			return nil
		})

		middlewareScenario(t, "ReqSignIn true and request with forceLogin in query string", func(sc *scenarioContext) {
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?forceLogin=true").exec()

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		})

		middlewareScenario(t, "ReqSignIn true and request with same org provided in query string", func(sc *scenarioContext) {
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?orgId=1").exec()

			assert.Equal(t, 200, scp.resp.Code)
		})

		middlewareScenario(t, "ReqSignIn true and request with different org provided in query string", func(sc *scenarioContext) {
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?orgId=2").exec()

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		})
	})

	Convey("snapshot public mode or signed in", func() {
		middlewareScenario(t, "Snapshot public mode disabled and unauthenticated request should return 401", func(sc *scenarioContext) {
			sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(), sc.defaultHandler)
			sc.fakeReq("GET", "/api/snapshot").exec()
			assert.Equal(t, 401, sc.resp.Code)
		})

		middlewareScenario(t, "Snapshot public mode enabled and unauthenticated request should return 200", func(sc *scenarioContext) {
			setting.SnapshotPublicMode = true
			sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(), sc.defaultHandler)
			sc.fakeReq("GET", "/api/snapshot").exec()
			assert.Equal(t, 200, sc.resp.Code)
		})
	})
}
