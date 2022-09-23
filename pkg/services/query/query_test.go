package query_test

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	dsSvc "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestQueryDataMultipleSources(t *testing.T) {
	t.Run("can query multiple datasources", func(t *testing.T) {
		tc := setup(t)
		query1, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				}
			}
		`))
		require.NoError(t, err)
		query2, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds2"
				}
			}
		`))
		require.NoError(t, err)
		queries := []*simplejson.Json{query1, query2}
		reqDTO := dtos.MetricRequest{
			From:                       "2022-01-01",
			To:                         "2022-01-02",
			Queries:                    queries,
			Debug:                      false,
			PublicDashboardAccessToken: "abc123",
			HTTPRequest:                nil,
		}

		_, err = tc.queryService.QueryDataMultipleSources(context.Background(), nil, true, reqDTO, false)

		require.NoError(t, err)
	})

	t.Run("can query multiple datasources with an expression present", func(t *testing.T) {
		tc := setup(t)
		query1, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				}
			}
		`))
		require.NoError(t, err)
		query2, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds2"
				}
			}
		`))
		require.NoError(t, err)
		query3, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"name": "Expression",
					"type": "__expr__",
					"uid": "__expr__"
				},
				"expression": "$A + 1",
				"hide": false,
				"refId": "EXPRESSION",
				"type": "math"
			}
		`))
		require.NoError(t, err)
		queries := []*simplejson.Json{query1, query2, query3}
		reqDTO := dtos.MetricRequest{
			From:                       "2022-01-01",
			To:                         "2022-01-02",
			Queries:                    queries,
			Debug:                      false,
			PublicDashboardAccessToken: "abc123",
			HTTPRequest:                nil,
		}

		_, err = tc.queryService.QueryDataMultipleSources(context.Background(), nil, true, reqDTO, false)

		require.NoError(t, err)
	})
}

func TestQueryData(t *testing.T) {
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
	fakeDatasourceService := &fakeDatasources.FakeDataSourceService{
		DataSources:           nil,
		SimulatePluginFailure: false,
	}
	exprService := expr.ProvideService(nil, pc, fakeDatasourceService)

	return &testContext{
		pluginContext:          pc,
		secretStore:            ss,
		dataSourceCache:        dc,
		oauthTokenService:      tc,
		pluginRequestValidator: rv,
		queryService:           query.ProvideService(nil, dc, exprService, rv, ds, pc, tc),
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

	// If an expression query ends up getting directly queried, we want it to return an error in our test.
	if req.PluginContext.PluginID == "__expr__" {
		return nil, errors.New("cant query an expression datasource")
	}

	return &backend.QueryDataResponse{Responses: make(backend.Responses)}, nil
}
