package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func setupAuthMiddlewareTest(t *testing.T, identity *authn.Identity, authErr error) *contexthandler.ContextHandler {
	return contexthandler.ProvideService(setting.NewCfg(), tracing.InitializeTracerForTest(), &authntest.FakeService{
		ExpectedErr:      authErr,
		ExpectedIdentity: identity,
	})
}

func TestAuth_Middleware(t *testing.T) {
	type testCase struct {
		desc           string
		identity       *authn.Identity
		path           string
		authErr        error
		authMiddleware web.Handler
		expecedReached bool
		expectedCode   int
	}

	tests := []testCase{
		{
			desc:           "ReqSignedIn should redirect unauthenticated request to secure endpoint",
			path:           "/secure",
			authMiddleware: ReqSignedIn,
			authErr:        errors.New("no auth"),
			expectedCode:   http.StatusFound,
		},
		{
			desc:           "ReqSignedIn should return 401 for api endpint",
			path:           "/api/secure",
			authMiddleware: ReqSignedIn,
			authErr:        errors.New("no auth"),
			expectedCode:   http.StatusUnauthorized,
		},
		{
			desc:           "ReqSignedIn should return 200 for anonymous user",
			path:           "/api/secure",
			authMiddleware: ReqSignedIn,
			identity:       &authn.Identity{ID: identity.AnonymousTypedID},
			expecedReached: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:           "ReqSignedIn should return redirect anonymous user with forceLogin query string",
			path:           "/secure?forceLogin=true",
			authMiddleware: ReqSignedIn,
			identity:       &authn.Identity{ID: identity.AnonymousTypedID},
			expecedReached: false,
			expectedCode:   http.StatusFound,
		},
		{
			desc:           "ReqSignedIn should return redirect anonymous user when orgId in query string is different from currently used",
			path:           "/secure?orgId=2",
			authMiddleware: ReqSignedIn,
			identity:       &authn.Identity{ID: identity.AnonymousTypedID, OrgID: 1},
			expecedReached: false,
			expectedCode:   http.StatusFound,
		},
		{
			desc:           "ReqSignedInNoAnonymous should return 401 for anonymous user",
			path:           "/api/secure",
			authMiddleware: ReqSignedInNoAnonymous,
			identity:       &authn.Identity{ID: identity.AnonymousTypedID},
			expecedReached: false,
			expectedCode:   http.StatusUnauthorized,
		},
		{
			desc:           "ReqSignedInNoAnonymous should return 200 for authenticated user",
			path:           "/api/secure",
			authMiddleware: ReqSignedInNoAnonymous,
			identity:       &authn.Identity{ID: identity.MustParseTypedID("user:1")},
			expecedReached: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:           "snapshot public mode disabled should return 200 for authenticated user",
			path:           "/api/secure",
			authMiddleware: SnapshotPublicModeOrSignedIn(&setting.Cfg{SnapshotPublicMode: false}),
			identity:       &authn.Identity{ID: identity.MustParseTypedID("user:1")},
			expecedReached: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:           "snapshot public mode disabled should return 401 for unauthenticated request",
			path:           "/api/secure",
			authMiddleware: SnapshotPublicModeOrSignedIn(&setting.Cfg{SnapshotPublicMode: false}),
			authErr:        errors.New("no auth"),
			expecedReached: false,
			expectedCode:   http.StatusUnauthorized,
		},
		{
			desc:           "snapshot public mode enabled should return 200 for unauthenticated request",
			path:           "/api/secure",
			authMiddleware: SnapshotPublicModeOrSignedIn(&setting.Cfg{SnapshotPublicMode: true}),
			authErr:        errors.New("no auth"),
			expecedReached: true,
			expectedCode:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			ctxHandler := setupAuthMiddlewareTest(t, tt.identity, tt.authErr)

			server := web.New()
			server.Use(ctxHandler.Middleware)
			server.Use(tt.authMiddleware)

			var reached bool
			server.Get("/secure", func(c *contextmodel.ReqContext) {
				reached = true
				c.Resp.WriteHeader(http.StatusOK)
			})
			server.Get("/api/secure", func(c *contextmodel.ReqContext) {
				reached = true
				c.Resp.WriteHeader(http.StatusOK)
			})

			req, err := http.NewRequest(http.MethodGet, tt.path, nil)
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			server.ServeHTTP(recorder, req)

			res := recorder.Result()
			assert.Equal(t, tt.expecedReached, reached)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestRoleAppPluginAuth(t *testing.T) {
	t.Run("Verify user's role when requesting app route which requires role", func(t *testing.T) {
		appSubURL := setting.AppSubUrl
		setting.AppSubUrl = "/grafana/"
		t.Cleanup(func() {
			setting.AppSubUrl = appSubURL
		})

		tcs := []struct {
			roleRequired org.RoleType
			role         org.RoleType
			expStatus    int
			expBody      string
			expLocation  string
		}{
			{roleRequired: org.RoleViewer, role: org.RoleAdmin, expStatus: http.StatusOK, expBody: ""},
			{roleRequired: org.RoleAdmin, role: org.RoleAdmin, expStatus: http.StatusOK, expBody: ""},
			{roleRequired: org.RoleAdmin, role: org.RoleViewer, expStatus: http.StatusFound, expBody: "<a href=\"/grafana/\">Found</a>.\n\n", expLocation: "/grafana/"},
			{roleRequired: "", role: org.RoleViewer, expStatus: http.StatusOK, expBody: ""},
			{roleRequired: org.RoleEditor, role: "", expStatus: http.StatusFound, expBody: "<a href=\"/grafana/\">Found</a>.\n\n", expLocation: "/grafana/"},
		}

		const path = "/a/test-app/test"
		for i, tc := range tcs {
			t.Run(fmt.Sprintf("testcase %d", i), func(t *testing.T) {
				ps := pluginstore.NewFakePluginStore(pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID: "test-app",
						Includes: []*plugins.Includes{
							{
								Type: "page",
								Role: tc.roleRequired,
								Path: path,
							},
						},
					},
				})

				middlewareScenario(t, t.Name(), func(t *testing.T, sc *scenarioContext) {
					sc.withIdentity(&authn.Identity{
						OrgRoles: map[int64]org.RoleType{
							0: tc.role,
						},
					})
					features := featuremgmt.WithFeatures()
					logger := &logtest.Fake{}
					ac := &actest.FakeAccessControl{}

					sc.m.Get("/a/:id/*", RoleAppPluginAuth(ac, ps, features, logger), func(c *contextmodel.ReqContext) {
						c.JSON(http.StatusOK, map[string]interface{}{})
					})
					sc.fakeReq("GET", path).exec()
					assert.Equal(t, tc.expStatus, sc.resp.Code)
					assert.Equal(t, tc.expBody, sc.resp.Body.String())
					assert.Equal(t, tc.expLocation, sc.resp.Header().Get("Location"))
				})
			})
		}
	})

	// We return success in this case because the frontend takes care of rendering the 404 page
	middlewareScenario(t, "Plugin is not found returns success", func(t *testing.T, sc *scenarioContext) {
		sc.withIdentity(&authn.Identity{
			OrgRoles: map[int64]org.RoleType{
				0: org.RoleViewer,
			},
		})
		features := featuremgmt.WithFeatures()
		logger := &logtest.Fake{}
		ac := &actest.FakeAccessControl{}
		sc.m.Get("/a/:id/*", RoleAppPluginAuth(ac, &pluginstore.FakePluginStore{}, features, logger), func(c *contextmodel.ReqContext) {
			c.JSON(http.StatusOK, map[string]interface{}{})
		})
		sc.fakeReq("GET", "/a/test-app/test").exec()
		assert.Equal(t, 200, sc.resp.Code)
		assert.Equal(t, "", sc.resp.Body.String())
	})

	// We return success in this case because the frontend takes care of rendering the right page based on its router
	middlewareScenario(t, "Plugin page not found returns success", func(t *testing.T, sc *scenarioContext) {
		sc.withIdentity(&authn.Identity{
			OrgRoles: map[int64]org.RoleType{
				0: org.RoleViewer,
			},
		})
		features := featuremgmt.WithFeatures()
		logger := &logtest.Fake{}
		ac := &actest.FakeAccessControl{}
		sc.m.Get("/a/:id/*", RoleAppPluginAuth(ac, pluginstore.NewFakePluginStore(pluginstore.Plugin{
			JSONData: plugins.JSONData{
				ID: "test-app",
				Includes: []*plugins.Includes{
					{
						Type: "page",
						Role: org.RoleViewer,
						Path: "/a/test-app/test",
					},
				},
			},
		}), features, logger), func(c *contextmodel.ReqContext) {
			c.JSON(http.StatusOK, map[string]interface{}{})
		})
		sc.fakeReq("GET", "/a/test-app/notExistingPath").exec()
		assert.Equal(t, 200, sc.resp.Code)
		assert.Equal(t, "", sc.resp.Body.String())
	})

	t.Run("Plugin include with RBAC", func(t *testing.T) {
		tcs := []struct {
			name        string
			evalResult  bool
			evalErr     error
			expStatus   int
			expBody     string
			expLocation string
		}{
			{
				name:        "Unsuccessful RBAC eval will result in a redirect",
				evalResult:  false,
				expStatus:   302,
				expBody:     "<a href=\"/\">Found</a>.\n\n",
				expLocation: "/",
			},
			{
				name:        "An RBAC eval error will result in a redirect",
				evalErr:     errors.New("eval error"),
				expStatus:   302,
				expBody:     "<a href=\"/\">Found</a>.\n\n",
				expLocation: "/",
			},
			{
				name:        "Successful RBAC eval will result in a successful request",
				evalResult:  true,
				expStatus:   200,
				expBody:     "",
				expLocation: "",
			},
		}

		for _, tc := range tcs {
			middlewareScenario(t, "Plugin include with RBAC", func(t *testing.T, sc *scenarioContext) {
				sc.withIdentity(&authn.Identity{
					OrgRoles: map[int64]org.RoleType{
						0: org.RoleViewer,
					},
				})
				logger := &logtest.Fake{}
				features := featuremgmt.WithFeatures(featuremgmt.FlagAccessControlOnCall)
				ac := &actest.FakeAccessControl{
					ExpectedEvaluate: tc.evalResult,
					ExpectedErr:      tc.evalErr,
				}
				path := "/a/test-app/test"
				ps := pluginstore.NewFakePluginStore(pluginstore.Plugin{
					JSONData: plugins.JSONData{
						ID: "test-app",
						Includes: []*plugins.Includes{
							{
								Type:   "page",
								Role:   org.RoleViewer,
								Path:   path,
								Action: "test-app.test:read",
							},
						},
					},
				})

				sc.m.Get("/a/:id/*", RoleAppPluginAuth(ac, ps, features, logger), func(c *contextmodel.ReqContext) {
					c.JSON(http.StatusOK, map[string]interface{}{})
				})
				sc.fakeReq("GET", path).exec()
				assert.Equal(t, tc.expStatus, sc.resp.Code)
				assert.Equal(t, tc.expBody, sc.resp.Body.String())
				assert.Equal(t, tc.expLocation, sc.resp.Header().Get("Location"))
			})
		}
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
