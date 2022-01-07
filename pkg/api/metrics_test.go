package api_test

import (
	"context"
	"net/http"
	"testing"

	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/services/accesscontrol"

	"github.com/grafana/grafana/pkg/web"

	"github.com/grafana/grafana/pkg/api/routing"

	"github.com/grafana/grafana/pkg/services/quota"

	"github.com/grafana/grafana/pkg/setting"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/stretchr/testify/require"
)

func TestQueryData(t *testing.T) {
	t.Run("it attaches custom headers to the request", func(t *testing.T) {
		tc := setup()
		tc.dataSourceCache.ds.JsonData = simplejson.NewFromAny(map[string]interface{}{"httpHeaderName1": "foo", "httpHeaderName2": "bar"})
		tc.secretService.decryptedJson = map[string]string{"httpHeaderValue1": "test-header", "httpHeaderValue2": "test-header2"}

		_ = tc.httpServer.QueryMetricsV2(requestContext, metricRequest())

		require.Equal(t, map[string]string{"foo": "test-header", "bar": "test-header2"}, tc.pluginContext.req.Headers)
	})

	t.Run("it attaches auth headers to the request", func(t *testing.T) {
		token := &oauth2.Token{
			TokenType:   "bearer",
			AccessToken: "access-token",
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})

		tc := setup()
		tc.oauthTokenService.passThruEnabled = true
		tc.oauthTokenService.token = token

		_ = tc.httpServer.QueryMetricsV2(requestContext, metricRequest())

		expected := map[string]string{
			"Authorization": "Bearer access-token",
			"X-ID-Token":    "id-token",
		}
		require.Equal(t, expected, tc.pluginContext.req.Headers)
	})
}

func setup() *testContext {
	pc := &fakePluginClient{}
	sc := &fakeSecretsService{}
	dc := &fakeDataSourceCache{ds: &models.DataSource{JsonData: simplejson.New()}}
	tc := &fakeOAuthTokenService{}
	rv := &fakePluginRequestValidator{}

	server, err := api.ProvideHTTPServer(
		api.ServerOptions{},
		&setting.Cfg{},
		&noOpRouteRegister{},
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		rv,
		nil,
		nil,
		nil,
		pc,
		nil,
		nil,
		dc,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		&fakeAccessControl{},
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		&quota.QuotaService{},
		nil,
		tc,
		nil,
		nil,
		nil,
		nil,
		sc,
		nil,
	)
	if err != nil {
		panic(err)
	}

	return &testContext{
		pluginContext:          pc,
		secretService:          sc,
		dataSourceCache:        dc,
		oauthTokenService:      tc,
		pluginRequestValidator: rv,
		httpServer:             server,
	}
}

type testContext struct {
	pluginContext          *fakePluginClient
	secretService          *fakeSecretsService
	dataSourceCache        *fakeDataSourceCache
	oauthTokenService      *fakeOAuthTokenService
	pluginRequestValidator *fakePluginRequestValidator
	httpServer             *api.HTTPServer
}

func metricRequest() dtos.MetricRequest {
	q, _ := simplejson.NewJson([]byte(`{"datasourceId":1}`))
	return dtos.MetricRequest{
		From:    "",
		To:      "",
		Queries: []*simplejson.Json{q},
		Debug:   false,
	}
}

var requestContext = &models.ReqContext{
	Context: &macaron.Context{
		Req: &http.Request{},
	},
}

type fakeAccessControl struct {
	accesscontrol.AccessControl
}

func (ac *fakeAccessControl) IsDisabled() bool {
	return true
}

func (ac *fakeAccessControl) DeclareFixedRoles(...accesscontrol.RoleRegistration) error {
	return nil
}

type noOpRouteRegister struct{}

func (noOpRouteRegister) Get(string, ...web.Handler)                                 {}
func (noOpRouteRegister) Post(string, ...web.Handler)                                {}
func (noOpRouteRegister) Delete(string, ...web.Handler)                              {}
func (noOpRouteRegister) Put(string, ...web.Handler)                                 {}
func (noOpRouteRegister) Patch(string, ...web.Handler)                               {}
func (noOpRouteRegister) Any(string, ...web.Handler)                                 {}
func (noOpRouteRegister) Group(string, func(routing.RouteRegister), ...web.Handler)  {}
func (noOpRouteRegister) Insert(string, func(routing.RouteRegister), ...web.Handler) {}
func (noOpRouteRegister) Register(routing.Router)                                    {}
func (noOpRouteRegister) Reset()                                                     {}

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

type fakeSecretsService struct {
	secrets.Service

	decryptedJson map[string]string
}

func (s *fakeSecretsService) DecryptJsonData(ctx context.Context, sjd map[string][]byte) (map[string]string, error) {
	return s.decryptedJson, nil
}

type fakeDataSourceCache struct {
	ds *models.DataSource
}

func (c *fakeDataSourceCache) GetDatasource(datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error) {
	return c.ds, nil
}

func (c *fakeDataSourceCache) GetDatasourceByUID(datasourceUID string, user *models.SignedInUser, skipCache bool) (*models.DataSource, error) {
	return c.ds, nil
}

type fakePluginClient struct {
	plugins.Client

	req *backend.QueryDataRequest
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	c.req = req
	return &backend.QueryDataResponse{}, nil
}
