package middleware

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
			sc.mockSQLStore.ExpectedOrg = &models.Org{Id: orgID, Name: "test"}
			sc.m.Get("/api/secure", ReqSignedInNoAnonymous, sc.defaultHandler)
			sc.fakeReq("GET", "/api/secure").exec()

			assert.Equal(t, 401, sc.resp.Code)
		}, configure)

		middlewareScenario(t, "ReqSignIn true and request with forceLogin in query string", func(
			t *testing.T, sc *scenarioContext) {
			sc.mockSQLStore.ExpectedOrg = &models.Org{Id: orgID, Name: "test"}
			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", "/secure?forceLogin=true").exec()

			assert.Equal(t, 302, sc.resp.Code)
			location, ok := sc.resp.Header()["Location"]
			assert.True(t, ok)
			assert.Equal(t, "/login", location[0])
		}, configure)

		middlewareScenario(t, "ReqSignIn true and request with same org provided in query string", func(
			t *testing.T, sc *scenarioContext) {
			sc.mockSQLStore.ExpectedOrg = &models.Org{Id: 1, Name: sc.cfg.AnonymousOrgName}
			org, err := sc.mockSQLStore.CreateOrgWithMember(sc.cfg.AnonymousOrgName, 1)
			require.NoError(t, err)

			sc.m.Get("/secure", reqSignIn, sc.defaultHandler)

			sc.fakeReq("GET", fmt.Sprintf("/secure?orgId=%d", org.Id)).exec()

			assert.Equal(t, 200, sc.resp.Code)
		}, configure)

		middlewareScenario(t, "ReqSignIn true and request with different org provided in query string", func(
			t *testing.T, sc *scenarioContext) {
			sc.mockSQLStore.ExpectedOrg = &models.Org{Id: 1, Name: sc.cfg.AnonymousOrgName}
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
		sc.m.Get("/api/snapshot", func(c *models.ReqContext) {
			c.IsSignedIn = false
		}, SnapshotPublicModeOrSignedIn(sc.cfg), sc.defaultHandler)
		sc.fakeReq("GET", "/api/snapshot").exec()
		assert.Equal(t, 401, sc.resp.Code)
	})

	middlewareScenario(t, "Snapshot public mode disabled and authenticated request should return 200", func(
		t *testing.T, sc *scenarioContext) {
		sc.m.Get("/api/snapshot", func(c *models.ReqContext) {
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

	t.Run("Verify user's role when requesting app route which requires role", func(t *testing.T) {
		tcs := []struct {
			roleRequired org.RoleType
			role         org.RoleType
			expStatus    int
			expBody      string
		}{
			{roleRequired: org.RoleViewer, role: org.RoleAdmin, expStatus: http.StatusOK, expBody: ""},
			{roleRequired: org.RoleAdmin, role: org.RoleAdmin, expStatus: http.StatusOK, expBody: ""},
			{roleRequired: org.RoleAdmin, role: org.RoleViewer, expStatus: http.StatusForbidden, expBody: ""},
			{roleRequired: "", role: org.RoleViewer, expStatus: http.StatusOK, expBody: ""},
			{roleRequired: org.RoleEditor, role: "", expStatus: http.StatusForbidden, expBody: ""},
		}

		for i, tc := range tcs {
			t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
				ps := newPluginStore(map[string]plugins.PluginDTO{
					"test-datasource": {
						JSONData: plugins.JSONData{
							ID: "test-datasource",
							Includes: []*plugins.Includes{
								{
									Type: plugins.PageIncludeType,
									Role: tc.roleRequired,
									Path: "/test",
								},
							},
						},
					},
				})

				middlewareScenario(t, t.Name(), func(t *testing.T, sc *scenarioContext) {
					sc.m.Get("/a/:id/*", func(c *models.ReqContext) {
						c.OrgRole = tc.role
					}, ReqRoleForAppRoute(ps, sc.cfg), func(c *models.ReqContext) {
						c.JSON(http.StatusOK, map[string]interface{}{})
					})
					sc.fakeReq("GET", "/a/test-datasource/test").exec()
					assert.Equal(t, tc.expStatus, sc.resp.Code)
					assert.Equal(t, tc.expBody, sc.resp.Body.String())
				})
			})
		}
	})

	middlewareScenario(t, "404", func(t *testing.T, sc *scenarioContext) {
		sc.m.Get("/a/:id/*", func(c *models.ReqContext) {
			c.OrgRole = org.RoleAdmin
		}, ReqRoleForAppRoute(newPluginStore(map[string]plugins.PluginDTO{}), sc.cfg), func(c *models.ReqContext) {
			c.JSON(http.StatusOK, map[string]interface{}{})
		})
		sc.fakeReq("GET", "/a/test-datasource/test").exec()
		assert.Equal(t, 404, sc.resp.Code)
		assert.Equal(t, "", sc.resp.Body.String())
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

type fakePluginStore struct {
	plugins.Store

	plugins map[string]plugins.PluginDTO
}

func newPluginStore(p map[string]plugins.PluginDTO) fakePluginStore {
	return fakePluginStore{
		plugins: p,
	}
}

func (pr fakePluginStore) Plugin(_ context.Context, pluginID string) (plugins.PluginDTO, bool) {
	p, exists := pr.plugins[pluginID]

	return p, exists
}
