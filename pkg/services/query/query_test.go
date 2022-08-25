package query_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsSvc "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestQueryData(t *testing.T) {
	t.Run("it attaches custom headers to the request", func(t *testing.T) {
		tc := setup(t)
		tc.dataSourceCache.ds.JsonData = simplejson.NewFromAny(map[string]interface{}{"httpHeaderName1": "foo", "httpHeaderName2": "bar"})

		secureJsonData, err := json.Marshal(map[string]string{"httpHeaderValue1": "test-header", "httpHeaderValue2": "test-header2"})
		require.NoError(t, err)

		err = tc.secretStore.Set(context.Background(), tc.dataSourceCache.ds.OrgId, tc.dataSourceCache.ds.Name, "datasource", string(secureJsonData))
		require.NoError(t, err)

		_, err = tc.queryService.QueryData(context.Background(), nil, true, metricRequest(), false)
		require.Nil(t, err)

		require.Equal(t, map[string]string{"foo": "test-header", "bar": "test-header2"}, tc.pluginContext.req.Headers)
	})

	t.Run("it auth custom headers to the request", func(t *testing.T) {
		token := &oauth2.Token{
			TokenType:   "bearer",
			AccessToken: "access-token",
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})

		tc := setup(t)
		tc.oauthTokenService.passThruEnabled = true
		tc.oauthTokenService.token = token

		_, err := tc.queryService.QueryData(context.Background(), nil, true, metricRequest(), false)
		require.Nil(t, err)

		expected := map[string]string{
			"Authorization": "Bearer access-token",
			"X-ID-Token":    "id-token",
		}
		require.Equal(t, expected, tc.pluginContext.req.Headers)
	})

	t.Run("it doesn't add cookie header to the request when keepCookies configured and no cookies provided", func(t *testing.T) {
		tc := setup(t)
		json, err := simplejson.NewJson([]byte(`{"keepCookies": [ "foo", "bar" ]}`))
		require.NoError(t, err)
		tc.dataSourceCache.ds.JsonData = json

		metricReq := metricRequest()
		httpReq, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		metricReq.HTTPRequest = httpReq
		_, err = tc.queryService.QueryData(context.Background(), nil, true, metricReq, false)
		require.NoError(t, err)

		require.Empty(t, tc.pluginContext.req.Headers)
	})

	t.Run("it adds cookie header to the request when keepCookies configured and cookie provided", func(t *testing.T) {
		tc := setup(t)
		json, err := simplejson.NewJson([]byte(`{"keepCookies": [ "foo", "bar" ]}`))
		require.NoError(t, err)
		tc.dataSourceCache.ds.JsonData = json

		metricReq := metricRequest()
		httpReq, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		httpReq.AddCookie(&http.Cookie{Name: "a"})
		httpReq.AddCookie(&http.Cookie{Name: "bar", Value: "rab"})
		httpReq.AddCookie(&http.Cookie{Name: "b"})
		httpReq.AddCookie(&http.Cookie{Name: "foo", Value: "oof"})
		httpReq.AddCookie(&http.Cookie{Name: "c"})
		metricReq.HTTPRequest = httpReq
		_, err = tc.queryService.QueryData(context.Background(), nil, true, metricReq, false)
		require.NoError(t, err)

		require.Equal(t, map[string]string{"Cookie": "bar=rab; foo=oof"}, tc.pluginContext.req.Headers)
	})
}

func setup(t *testing.T) *testContext {
	pc := &fakePluginClient{}
	dc := &fakeDataSourceCache{ds: &datasources.DataSource{}}
	tc := &fakeOAuthTokenService{}
	rv := &fakePluginRequestValidator{}

	sqlStore := sqlstore.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	ss := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	ssvc := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	ds := dsSvc.ProvideService(nil, ssvc, ss, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService())

	return &testContext{
		pluginContext:          pc,
		secretStore:            ss,
		dataSourceCache:        dc,
		oauthTokenService:      tc,
		pluginRequestValidator: rv,
		queryService:           query.ProvideService(nil, dc, nil, rv, ds, pc, tc),
	}
}

type testContext struct {
	pluginContext          *fakePluginClient
	secretStore            secretskvs.SecretsKVStore
	dataSourceCache        *fakeDataSourceCache
	oauthTokenService      *fakeOAuthTokenService
	pluginRequestValidator *fakePluginRequestValidator
	queryService           *query.Service
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

type fakeDataSourceCache struct {
	ds *datasources.DataSource
}

func (c *fakeDataSourceCache) GetDatasource(ctx context.Context, datasourceID int64, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	return c.ds, nil
}

func (c *fakeDataSourceCache) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	return c.ds, nil
}

type fakePluginClient struct {
	plugins.Client

	req *backend.QueryDataRequest
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	c.req = req
	return nil, nil
}
