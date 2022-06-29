package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func setupTestServer(
	t *testing.T,
	cfg *setting.Cfg,
	qs *query.Service,
	features *featuremgmt.FeatureManager,
	service publicdashboards.Service,
) *web.Mux {

	// build router to register routes
	rr := routing.NewRouteRegister()

	// build access control
	ac := accesscontrolmock.New()

	// build mux
	m := web.New()
	m.Use(func(c *web.Context) {
		ctx := &models.ReqContext{
			Context:    c,
			IsSignedIn: false,
			SkipCache:  true, // hardcoded to make sure query service doesnt hit the cache
			Logger:     log.New("publicdashboards-test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), ctx))
	})

	// build api, this will mount the routes at the same time if
	// featuremgmt.FlagPublicDashboard is enabled
	ProvideApi(service, rr, ac, qs, features)

	return m
}

func callAPI(server *web.Mux, method, path string, body io.Reader, t *testing.T) *httptest.ResponseRecorder {
	req, err := http.NewRequest(method, path, body)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, req)
	return recorder
}

//func setupHTTPServerWithMockDb(t *testing.T, useFakeAccessControl, enableAccessControl bool, features *featuremgmt.FeatureManager, store sqlstore.Store) scenarioContext {
//  // Use a new conf
//  cfg := setting.NewCfg()
//  routeRegister := routing.NewRouteRegister()
//  var acmock *accesscontrolmock.Mock

//  // Create minimal HTTP Server
//  hs := &grafanaapi.HTTPServer{
//    Cfg:      cfg,
//    Features: features,
//    //Live:                   newTestLive(t, db),
//    QuotaService:           &quota.QuotaService{Cfg: cfg},
//    RouteRegister:          routeRegister,
//    SQLStore:               store,
//    License:                &licensing.OSSLicensingService{},
//    AccessControl:          acmock,
//    publicDashboardService: publicdashboards.FakePublicDashboardService{},
//    dashboardService:       dashboards.FakeDashboardService{},
//    preferenceService:      preftest.NewPreferenceServiceFake(),
//  }

//  fmt.Println(hs)

//}

//func callAPI(server *web.Mux, method, path string, body io.Reader, t *testing.T) *httptest.ResponseRecorder {
//req, err := http.NewRequest(method, path, body)
//require.NoError(t, err)
//req.Header.Set("Content-Type", "application/json")
//recorder := httptest.NewRecorder()
//server.ServeHTTP(recorder, req)
//return recorder
//}

func buildQueryDataService(t *testing.T, cfg *setting.Cfg) *query.Service {
	db := sqlstore.InitTestDB(t)
	cacheService := datasourceService.ProvideCacheService(localcache.ProvideService(), db)

	return query.ProvideService(
		nil,
		cacheService,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		&fakePluginClient{
			QueryDataHandlerFunc: func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
				resp := backend.Responses{
					"A": backend.DataResponse{
						Frames: []*data.Frame{{}},
					},
				}
				return &backend.QueryDataResponse{Responses: resp}, nil
			},
		},
		&fakeOAuthTokenService{},
	)

}

//copied from pkg/api/metrics_test.go
type fakePluginRequestValidator struct {
	err error
}

func (rv *fakePluginRequestValidator) Validate(dsURL string, req *http.Request) error {
	return rv.err
}

type fakeOAuthTokenService struct {
	passThruEnabled bool
	token           *oauth2.Token
}

func (ts *fakeOAuthTokenService) GetCurrentOAuthToken(context.Context, *models.SignedInUser) *oauth2.Token {
	return ts.token
}

func (ts *fakeOAuthTokenService) IsOAuthPassThruEnabled(*models.DataSource) bool {
	return ts.passThruEnabled
}

// copied from pkg/api/plugins_test.go
type fakePluginClient struct {
	plugins.Client

	req *backend.CallResourceRequest

	backend.QueryDataHandlerFunc
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if c.QueryDataHandlerFunc != nil {
		return c.QueryDataHandlerFunc.QueryData(ctx, req)
	}

	return backend.NewQueryDataResponse(), nil
}
