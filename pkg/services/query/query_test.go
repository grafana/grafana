package query

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/httpclient/httpclientprovider"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	dsSvc "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

func TestParseMetricRequest(t *testing.T) {
	t.Run("Test a simple single datasource query", func(t *testing.T) {
		tc := setup(t)
		json, err := simplejson.NewJson([]byte(`{
			"keepCookies": [ "cookie1", "cookie3", "login" ]
		}`))
		require.NoError(t, err)
		tc.dataSourceCache.dsByUid = func(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
			if datasourceUID == "gIEkMvIVz" {
				return &datasources.DataSource{
					Uid:      "gIEkMvIVz",
					JsonData: json,
				}, nil
			}

			return nil, nil
		}

		token := &oauth2.Token{
			TokenType:   "bearer",
			AccessToken: "access-token",
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})

		tc.oauthTokenService.passThruEnabled = true
		tc.oauthTokenService.token = token

		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.False(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 2)
		assert.Equal(t, "gIEkMvIVz", parsedReq.parsedQueries[0].datasource.Uid)
		assert.Equal(t, "gIEkMvIVz", parsedReq.parsedQueries[1].datasource.Uid)

		t.Run("createDataSourceQueryEnrichers should return 0 enrichers when no HTTP request", func(t *testing.T) {
			enrichers := parsedReq.createDataSourceQueryEnrichers(context.Background(), nil, tc.oauthTokenService, []string{})
			require.Empty(t, enrichers)
		})

		t.Run("createDataSourceQueryEnrichers should return 1 enricher", func(t *testing.T) {
			parsedReq.httpRequest = httptest.NewRequest(http.MethodGet, "/", nil)
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "cookie1"})
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "cookie2"})
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "cookie3"})
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "login"})

			enrichers := parsedReq.createDataSourceQueryEnrichers(context.Background(), nil, tc.oauthTokenService, []string{"login"})
			require.Len(t, enrichers, 1)
			require.NotNil(t, enrichers["gIEkMvIVz"])
			req := &backend.QueryDataRequest{}
			ctx := enrichers["gIEkMvIVz"](context.Background(), req)
			require.Len(t, req.Headers, 3)
			require.Equal(t, "Bearer access-token", req.Headers["Authorization"])
			require.Equal(t, "id-token", req.Headers["X-ID-Token"])
			require.Equal(t, "cookie1=; cookie3=", req.Headers["Cookie"])
			middlewares := httpclient.ContextualMiddlewareFromContext(ctx)
			require.Len(t, middlewares, 2)
			require.Equal(t, httpclientprovider.ForwardedCookiesMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())
			require.Equal(t, httpclientprovider.ForwardedOAuthIdentityMiddlewareName, middlewares[1].(httpclient.MiddlewareName).MiddlewareName())
		})
	})

	t.Run("Test a single datasource query with expressions", func(t *testing.T) {
		tc := setup(t)
		json, err := simplejson.NewJson([]byte(`{
			"keepCookies": [ "cookie1", "cookie3", "login" ]
		}`))
		require.NoError(t, err)
		tc.dataSourceCache.dsByUid = func(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
			if datasourceUID == "gIEkMvIVz" {
				return &datasources.DataSource{
					Uid:      "gIEkMvIVz",
					JsonData: json,
				}, nil
			}

			return nil, nil
		}

		token := &oauth2.Token{
			TokenType:   "bearer",
			AccessToken: "access-token",
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})

		tc.oauthTokenService.passThruEnabled = true
		tc.oauthTokenService.token = token

		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"type": "math",
			"expression": "$A - 50"
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.True(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 2)
		assert.Equal(t, "gIEkMvIVz", parsedReq.parsedQueries[0].datasource.Uid)
		assert.Equal(t, expr.DatasourceUID, parsedReq.parsedQueries[1].datasource.Uid)

		// Make sure we end up with something valid
		_, err = tc.queryService.handleExpressions(context.Background(), tc.signedInUser, parsedReq)
		assert.NoError(t, err)

		t.Run("createDataSourceQueryEnrichers should return 1 enricher", func(t *testing.T) {
			parsedReq.httpRequest = httptest.NewRequest(http.MethodGet, "/", nil)
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "cookie1"})
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "cookie2"})
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "cookie3"})
			parsedReq.httpRequest.AddCookie(&http.Cookie{Name: "login"})

			enrichers := parsedReq.createDataSourceQueryEnrichers(context.Background(), nil, tc.oauthTokenService, []string{"login"})
			require.Len(t, enrichers, 1)
			require.NotNil(t, enrichers["gIEkMvIVz"])

			req := &backend.QueryDataRequest{}
			ctx := enrichers["gIEkMvIVz"](context.Background(), req)
			require.Len(t, req.Headers, 3)
			require.Equal(t, "Bearer access-token", req.Headers["Authorization"])
			require.Equal(t, "id-token", req.Headers["X-ID-Token"])
			require.Equal(t, "cookie1=; cookie3=", req.Headers["Cookie"])
			middlewares := httpclient.ContextualMiddlewareFromContext(ctx)
			require.Len(t, middlewares, 2)
			require.Equal(t, httpclientprovider.ForwardedCookiesMiddlewareName, middlewares[0].(httpclient.MiddlewareName).MiddlewareName())
			require.Equal(t, httpclientprovider.ForwardedOAuthIdentityMiddlewareName, middlewares[1].(httpclient.MiddlewareName).MiddlewareName())
		})
	})

	t.Run("Test a mixed datasource query with expressions", func(t *testing.T) {
		tc := setup(t)
		mr := metricRequestWithQueries(t, `{
			"refId": "A",
			"datasource": {
				"uid": "gIEkMvIVz",
				"type": "postgres"
			}
		}`, `{
			"refId": "B",
			"datasource": {
				"uid": "sEx6ZvSVk",
				"type": "testdata"
			}
		}`, `{
			"refId": "A_resample",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"expression": "A",
			"type": "resample",
			"downsampler": "mean",
			"upsampler": "fillna",
			"window": "10s"
		}`, `{
			"refId": "B_resample",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"expression": "B",
			"type": "resample",
			"downsampler": "mean",
			"upsampler": "fillna",
			"window": "10s"
		}`, `{
			"refId": "C",
			"datasource": {
				"type": "__expr__",
				"uid": "__expr__",
				"name": "Expression"
			},
			"type": "math",
			"expression": "$A_resample + $B_resample"
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.True(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 5)
		assert.Equal(t, "gIEkMvIVz", parsedReq.parsedQueries[0].datasource.Uid)
		assert.Equal(t, "sEx6ZvSVk", parsedReq.parsedQueries[1].datasource.Uid)
		assert.Equal(t, expr.DatasourceUID, parsedReq.parsedQueries[2].datasource.Uid)
		assert.Equal(t, expr.DatasourceUID, parsedReq.parsedQueries[3].datasource.Uid)
		assert.Equal(t, expr.DatasourceUID, parsedReq.parsedQueries[4].datasource.Uid)
		// Make sure we end up with something valid
		_, err = tc.queryService.handleExpressions(context.Background(), tc.signedInUser, parsedReq)
		assert.NoError(t, err)

		t.Run("createDataSourceQueryEnrichers should return 2 enrichers", func(t *testing.T) {
			parsedReq.httpRequest = &http.Request{}
			enrichers := parsedReq.createDataSourceQueryEnrichers(context.Background(), nil, tc.oauthTokenService, []string{})
			require.Len(t, enrichers, 2)
			require.NotNil(t, enrichers["gIEkMvIVz"])
			require.NotNil(t, enrichers["sEx6ZvSVk"])
		})
	})
}

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

		metricReq := metricRequest()
		httpReq, err := http.NewRequest(http.MethodGet, "/", nil)
		require.NoError(t, err)
		metricReq.HTTPRequest = httpReq

		_, err = tc.queryService.QueryData(context.Background(), nil, true, metricReq, false)
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
	cfg := setting.NewCfg()
	cfg.ExpressionsEnabled = true
	exprService := expr.ProvideService(cfg, pc, fakeDatasourceService)

	return &testContext{
		pluginContext:          pc,
		secretStore:            ss,
		dataSourceCache:        dc,
		oauthTokenService:      tc,
		pluginRequestValidator: rv,
		queryService:           ProvideService(setting.NewCfg(), dc, exprService, rv, ds, pc, tc),
		signedInUser:           &user.SignedInUser{OrgID: 1},
	}
}

type testContext struct {
	pluginContext          *fakePluginClient
	secretStore            secretskvs.SecretsKVStore
	dataSourceCache        *fakeDataSourceCache
	oauthTokenService      *fakeOAuthTokenService
	pluginRequestValidator *fakePluginRequestValidator
	queryService           *Service
	signedInUser           *user.SignedInUser
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

func metricRequestWithQueries(t *testing.T, rawQueries ...string) dtos.MetricRequest {
	t.Helper()
	queries := make([]*simplejson.Json, 0)
	for _, q := range rawQueries {
		json, err := simplejson.NewJson([]byte(q))
		require.NoError(t, err)
		queries = append(queries, json)
	}
	return dtos.MetricRequest{
		From:    "now-1h",
		To:      "now",
		Queries: queries,
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
	ds      *datasources.DataSource
	dsByUid func(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error)
}

func (c *fakeDataSourceCache) GetDatasource(ctx context.Context, datasourceID int64, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	return c.ds, nil
}

func (c *fakeDataSourceCache) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	if c.dsByUid != nil {
		return c.dsByUid(ctx, datasourceUID, user, skipCache)
	}

	return &datasources.DataSource{
		Uid: datasourceUID,
	}, nil
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
