package api

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/web"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func setupTestServer(
	t *testing.T,
	cfg *setting.Cfg,
	service publicdashboards.Service,
	user *user.SignedInUser,
) *web.Mux {
	t.Helper()

	// build router to register routes
	rr := routing.NewRouteRegister()

	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	// build mux
	m := web.New()

	// set initial context
	m.Use(contextProvider(&testContext{user}))

	features := featuremgmt.WithFeatures()

	if cfg == nil {
		cfg = setting.NewCfg()
		cfg.PublicDashboardsEnabled = true
	}

	// build api, this will mount the routes at the same time if the feature is enabled
	license := licensingtest.NewFakeLicensing()
	license.On("FeatureEnabled", publicdashboardModels.FeaturePublicDashboardsEmailSharing).Return(false)
	ProvideApi(service, rr, ac, features, &Middleware{}, cfg, license)

	// connect routes to mux
	rr.Register(m.Router)

	return m
}

type testContext struct {
	user *user.SignedInUser
}

func contextProvider(tc *testContext) web.Handler {
	return func(c *web.Context) {
		signedIn := tc.user != nil && !tc.user.IsAnonymous
		reqCtx := &contextmodel.ReqContext{
			Context:      c,
			SignedInUser: tc.user,
			IsSignedIn:   signedIn,
			SkipDSCache:  true,
			Logger:       log.New("publicdashboards-test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), reqCtx))
	}
}

func callAPI(server *web.Mux, method, path string, body io.Reader, t *testing.T) *httptest.ResponseRecorder {
	req, err := http.NewRequest(method, path, body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, req)
	return recorder
}
