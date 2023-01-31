package middleware

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMiddlewareAuth(t *testing.T) {
	reqSignIn := Auth(&AuthOptions{ReqSignedIn: true})

	middlewareScenario(t, "ReqSignIn true and unauthenticated request", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/secure", reqSignIn, sc.defaultHandler)
		sc.fakeReq("GET", "/secure").exec()

		assert.Equal(t, 302, sc.resp.Code)
	})

	middlewareScenario(t, "ReqSignIn true and unauthenticated API request", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/api/secure", reqSignIn, sc.defaultHandler)

		sc.fakeReq("GET", "/api/secure").exec()

		assert.Equal(t, 401, sc.resp.Code)
	})

	t.Run("Anonymous auth enabled", func(t *testing.T) {
		const orgID int64 = 1

		configure := func(cfg *setting.Cfg) {
			cfg.AnonymousEnabled = true
			cfg.AnonymousOrgName = "test"
		}

		middlewareScenario(t, "ReqSignIn true and NoAnonynmous true", func(
			t *testing.T, sc *scenarioContext) {
			sc.orgService.ExpectedOrg = &org.Org{ID: orgID, Name: "test"}
			sc.m.Get("/api/secure", ReqSignedInNoAnonymous, sc.defaultHandler)
			sc.fakeReq("GET", "/api/secure").exec()

			assert.Equal(t, 401, sc.resp.Code)
		}, configure)

		middlewareScenario(t, "ReqSignIn true and request with forceLogin in query string", func(
			t *testing.T, sc *scenarioContext) {
			sc.orgService.ExpectedOrg = &org.Org{ID: orgID, Name: "test"}
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?forceLogin=true").exec()

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		}, configure)

		middlewareScenario(t, "ReqSignIn true and request with same org provided in query string", func(
			t *testing.T, sc *scenarioContext) {
			sc.orgService.ExpectedOrg = &org.Org{ID: 1, Name: sc.cfg.AnonymousOrgName}

			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", fmt.Sprintf("/secure?orgId=%d", 1)).exec()

			assert.Equal(t, 200, sc.resp.Code)
		}, configure)

		middlewareScenario(t, "ReqSignIn true and request with different org provided in query string", func(
			t *testing.T, sc *scenarioContext) {
			sc.orgService.ExpectedOrg = &org.Org{ID: 1, Name: sc.cfg.AnonymousOrgName}
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?orgId=2").exec()

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		}, configure)
	})

	middlewareScenario(t, "Snapshot public mode disabled and unauthenticated request should return 401", func(
		t *testing.T, sc *scenarioContext) {
		sc.m.Get("/api/snapshot", func(c *contextmodel.ReqContext) {
			c.IsSignedIn = false
		}, SnapshotPublicModeOrSignedIn(sc.cfg), sc.defaultHandler)
		sc.fakeReq("GET", "/api/snapshot").exec()
		assert.Equal(t, 401, sc.resp.Code)
	})

	middlewareScenario(t, "Snapshot public mode disabled and authenticated request should return 200", func(
		t *testing.T, sc *scenarioContext) {
		sc.m.Get("/api/snapshot", func(c *contextmodel.ReqContext) {
			c.IsSignedIn = true
		}, SnapshotPublicModeOrSignedIn(sc.cfg), sc.defaultHandler)
		sc.fakeReq("GET", "/api/snapshot").exec()
		assert.Equal(t, 200, sc.resp.Code)
	})

	middlewareScenario(t, "Snapshot public mode enabled and unauthenticated request should return 200", func(
		t *testing.T, sc *scenarioContext) {
		sc.cfg.SnapshotPublicMode = true
		sc.m.Get("/api/snapshot", SnapshotPublicModeOrSignedIn(sc.cfg), sc.defaultHandler)
		sc.fakeReq("GET", "/api/snapshot").exec()
		assert.Equal(t, 200, sc.resp.Code)
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
