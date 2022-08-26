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
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"

	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	datasourceService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

type Server struct {
	Mux           *web.Mux
	RouteRegister routing.RouteRegister
	TestServer    *httptest.Server
}

func setupTestServer(
	t *testing.T,
	cfg *setting.Cfg,
	qs *query.Service,
	features *featuremgmt.FeatureManager,
	service publicdashboards.Service,
	db *sqlstore.SQLStore,
) *web.Mux {
	// build router to register routes
	rr := routing.NewRouteRegister()

	// build access control - FIXME we should be able to mock this, but to get
	// tests going, we're going to instantiate full accesscontrol
	//ac := accesscontrolmock.New()
	//ac.WithDisabled()

	// create a sqlstore for access control.
	if db == nil {
		db = sqlstore.InitTestDB(t)
	}

	var err error
	acService, err := ossaccesscontrol.ProvideService(cfg, database.ProvideService(db), rr)
	require.NoError(t, err)
	ac := ossaccesscontrol.ProvideAccessControl(cfg, acService)

	// build mux
	m := web.New()

	// set initial context
	m.Use(func(c *web.Context) {
		ctx := &models.ReqContext{
			Context:    c,
			IsSignedIn: true, // FIXME need to be able to change this for tests
			SkipCache:  true, // hardcoded to make sure query service doesnt hit the cache
			Logger:     log.New("publicdashboards-test"),

			// Set signed in user. We might not actually need to do this.
			SignedInUser: &user.SignedInUser{UserID: 1, OrgID: 1, OrgRole: org.RoleAdmin, Login: "testUser"},
		}
		c.Req = c.Req.WithContext(ctxkey.Set(c.Req.Context(), ctx))
	})

	// build api, this will mount the routes at the same time if
	// featuremgmt.FlagPublicDashboard is enabled
	ProvideApi(service, rr, ac, qs, features)

	// connect routes to mux
	rr.Register(m.Router)

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

// helper to query.Service
// allows us to stub the cache and plugin clients
func buildQueryDataService(t *testing.T, cs datasources.CacheService, fpc *fakePluginClient, store *sqlstore.SQLStore) *query.Service {
	//	build database if we need one
	if store == nil {
		store = sqlstore.InitTestDB(t)
	}

	// default cache service
	if cs == nil {
		cs = datasourceService.ProvideCacheService(localcache.ProvideService(), store)
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

	return query.ProvideService(
		nil,
		cs,
		nil,
		&fakePluginRequestValidator{},
		&fakeDatasources.FakeDataSourceService{},
		fpc,
		&fakeOAuthTokenService{},
	)
}

// copied from pkg/api/metrics_test.go
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

func (ts *fakeOAuthTokenService) GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token {
	return ts.token
}

func (ts *fakeOAuthTokenService) IsOAuthPassThruEnabled(*datasources.DataSource) bool {
	return ts.passThruEnabled
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
