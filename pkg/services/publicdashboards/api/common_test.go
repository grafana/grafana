package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/datasources/guardian"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	pluginSettings "github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings/service"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/query"
	fakeSecrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
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

	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())

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

// helper to query.Service
// allows us to stub the cache and plugin clients
func buildQueryDataService(t *testing.T, cs datasources.CacheService, fpc *fakePluginClient, store db.DB) *query.ServiceImpl {
	//	build database if we need one
	if store == nil {
		store = db.InitTestDB(t)
	}

	// default cache service
	if cs == nil {
		cs = datasourceService.ProvideCacheService(localcache.ProvideService(), store, guardian.ProvideGuardian())
	}

	// default fakePluginClient
	if fpc == nil {
		fpc = &fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Frames: []*data.Frame{{}},
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		}
	}

	ds := &fakeDatasources.FakeDataSourceService{}
	pCtxProvider := plugincontext.ProvideService(setting.NewCfg(),
		localcache.ProvideService(), &pluginstore.FakePluginStore{
			PluginList: []pluginstore.Plugin{
				{
					JSONData: plugins.JSONData{
						ID: "mysql",
					},
				},
			},
		}, &fakeDatasources.FakeCacheService{}, ds,
		pluginSettings.ProvideService(store, fakeSecrets.NewFakeSecretsService()), pluginconfig.NewFakePluginRequestConfigProvider())

	return query.ProvideService(
		setting.NewCfg(),
		cs,
		nil,
		&fakePluginRequestValidator{},
		fpc,
		pCtxProvider,
	)
}

// copied from pkg/api/metrics_test.go
type fakePluginRequestValidator struct {
	err error
}

func (rv *fakePluginRequestValidator) Validate(dsURL string, req *http.Request) error {
	return rv.err
}

// copied from pkg/api/plugins_test.go
type fakePluginClient struct {
	plugins.Client
	backend.QueryDataHandlerFunc
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.QueryDataHandlerFunc != nil {
		return c.QueryDataHandlerFunc.QueryData(ctx, req)
	}

	return backend.NewQueryDataResponse(), nil
}
