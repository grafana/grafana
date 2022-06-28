package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	accesscontrolmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/publicdashboards/service"

	//"github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

//type scenarioContext struct {
//t          *testing.T
//ctx        *web.Context
//service    *publicdashboards.Service
//reqContext *models.ReqContext
//sqlStore   *sqlstore.SQLStore
//}

func setupTestServer(
	t *testing.T,
	qs *query.Service,
	features *featuremgmt.FeatureManager,
	store publicdashboards.Store,
) *web.Mux {

	// build config
	cfg := setting.NewCfg()

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
			Logger:     log.New("publicdashboards-test"),
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), ctx))
	})

	// build service, this will mount the routes at the same time if
	// featuremgmt.FlagPublicDashboard is enabled
	service.ProvideService(cfg, store, rr, ac, qs, features)

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

func buildQueryDataService() *query.Service {
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
