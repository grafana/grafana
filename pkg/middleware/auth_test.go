package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func setupAuthMiddlewareTest(t *testing.T, identity *authn.Identity, authErr error) *contexthandler.ContextHandler {
	return contexthandler.ProvideService(setting.NewCfg(), tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), &authntest.FakeService{
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
			identity:       &authn.Identity{ID: authn.AnonymousNamespaceID},
			expecedReached: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:           "ReqSignedIn should return redirect anonymous user with forceLogin query string",
			path:           "/secure?forceLogin=true",
			authMiddleware: ReqSignedIn,
			identity:       &authn.Identity{ID: authn.AnonymousNamespaceID},
			expecedReached: false,
			expectedCode:   http.StatusFound,
		},
		{
			desc:           "ReqSignedIn should return redirect anonymous user when orgId in query string is different from currently used",
			path:           "/secure?orgId=2",
			authMiddleware: ReqSignedIn,
			identity:       &authn.Identity{ID: authn.AnonymousNamespaceID, OrgID: 1},
			expecedReached: false,
			expectedCode:   http.StatusFound,
		},
		{
			desc:           "ReqSignedInNoAnonymous should return 401 for anonymous user",
			path:           "/api/secure",
			authMiddleware: ReqSignedInNoAnonymous,
			identity:       &authn.Identity{ID: authn.AnonymousNamespaceID},
			expecedReached: false,
			expectedCode:   http.StatusUnauthorized,
		},
		{
			desc:           "ReqSignedInNoAnonymous should return 200 for authenticated user",
			path:           "/api/secure",
			authMiddleware: ReqSignedInNoAnonymous,
			identity:       &authn.Identity{ID: "user:1"},
			expecedReached: true,
			expectedCode:   http.StatusOK,
		},
		{
			desc:           "snapshot public mode disabled should return 200 for authenticated user",
			path:           "/api/secure",
			authMiddleware: SnapshotPublicModeOrSignedIn(&setting.Cfg{SnapshotPublicMode: false}),
			identity:       &authn.Identity{ID: "user:1"},
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
