package middleware

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		const orgID int64 = 1

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

		middlewareScenario(t, "ReqSignIn true and request with forceLogin in query string", func(sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
				query.Result = &models.Org{Id: orgID, Name: "test"}
				return nil
			})

			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?forceLogin=true").exec()

			assert.Equal(sc.t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		})

		middlewareScenario(t, "ReqSignIn true and request with same org provided in query string", func(sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
				query.Result = &models.Org{Id: orgID, Name: "test"}
				return nil
			})

			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", fmt.Sprintf("/secure?orgId=%d", orgID)).exec()

			assert.Equal(sc.t, 200, sc.resp.Code)
		})

		middlewareScenario(t, "ReqSignIn true and request with different org provided in query string", func(sc *scenarioContext) {
			bus.AddHandler("test", func(query *models.GetOrgByNameQuery) error {
				query.Result = &models.Org{Id: orgID, Name: "test"}
				return nil
			})

			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?orgId=2").exec()

			assert.Equal(sc.t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(sc.t, ok)
			assert.Equal(sc.t, "/login", location[0])
		})
	})

	middlewareScenario(t, "Snapshot public mode disabled and unauthenticated request should return 401", func(sc *scenarioContext) {
		sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(), sc.defaultHandler)
		sc.fakeReq("GET", "/api/snapshot").exec()
		assert.Equal(sc.t, 401, sc.resp.Code)
	})

	middlewareScenario(t, "Snapshot public mode enabled and unauthenticated request should return 200", func(sc *scenarioContext) {
		setting.SnapshotPublicMode = true
		sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(), sc.defaultHandler)
		sc.fakeReq("GET", "/api/snapshot").exec()
		assert.Equal(sc.t, 200, sc.resp.Code)
	})
}

func TestRemoveForceLoginparams(t *testing.T) {
	tcs := []struct {
		inp string
		exp string
	}{
		{inp: "/?forceLogin=true", exp: "/?"},
		{inp: "/d/dash/dash-title?ordId=1&forceLogin=true", exp: "/d/dash/dash-title?ordId=1"},
		{inp: "/?kiosk&forceLogin=true", exp: "/?kiosk"},
		{inp: "/d/dash/dash-title?ordId=1&kiosk&forceLogin=true", exp: "/d/dash/dash-title?ordId=1&kiosk"},
		{inp: "/d/dash/dash-title?ordId=1&forceLogin=true&kiosk", exp: "/d/dash/dash-title?ordId=1&kiosk"},
		{inp: "/d/dash/dash-title?forceLogin=true&kiosk", exp: "/d/dash/dash-title?&kiosk"},
	}
	for i, tc := range tcs {
		t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
			require.Equal(t, tc.exp, removeForceLoginParams(tc.inp))
		})
	}
}
