package query

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	exprservice "github.com/grafana/grafana/pkg/expr/service"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	dsSvc "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestParseMetricRequest(t *testing.T) {
	tc := setup(t)

	t.Run("Test a simple single datasource query", func(t *testing.T) {
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
		assert.Len(t, parsedReq.parsedQueries, 1)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Len(t, parsedReq.getFlattenedQueries(), 2)
	})

	t.Run("Test a single datasource query with expressions", func(t *testing.T) {
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
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Len(t, parsedReq.getFlattenedQueries(), 2)
		// Make sure we end up with something valid
		_, err = tc.queryService.handleExpressions(context.Background(), tc.signedInUser, parsedReq)
		assert.NoError(t, err)
	})

	t.Run("Test a simple mixed datasource query", func(t *testing.T) {
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
		}`)
		parsedReq, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)
		require.NotNil(t, parsedReq)
		assert.False(t, parsedReq.hasExpression)
		assert.Len(t, parsedReq.parsedQueries, 2)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Contains(t, parsedReq.parsedQueries, "sEx6ZvSVk")
		assert.Len(t, parsedReq.getFlattenedQueries(), 2)
	})

	t.Run("Test a mixed datasource query with expressions", func(t *testing.T) {
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
		assert.Len(t, parsedReq.parsedQueries, 3)
		assert.Contains(t, parsedReq.parsedQueries, "gIEkMvIVz")
		assert.Contains(t, parsedReq.parsedQueries, "sEx6ZvSVk")
		assert.Len(t, parsedReq.getFlattenedQueries(), 5)
		// Make sure we end up with something valid
		_, err = tc.queryService.handleExpressions(context.Background(), tc.signedInUser, parsedReq)
		assert.NoError(t, err)
	})

	t.Run("Header validation", func(t *testing.T) {
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
		}`)
		httpreq, _ := http.NewRequest(http.MethodPost, "http://localhost/", bytes.NewReader([]byte{}))
		httpreq.Header.Add("X-Datasource-Uid", "gIEkMvIVz")
		mr.HTTPRequest = httpreq
		_, err := tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)

		// With the second value it is OK
		httpreq.Header.Add("X-Datasource-Uid", "sEx6ZvSVk")
		mr.HTTPRequest = httpreq
		_, err = tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)

		// Single header with comma syntax
		httpreq, _ = http.NewRequest(http.MethodPost, "http://localhost/", bytes.NewReader([]byte{}))
		httpreq.Header.Set("X-Datasource-Uid", "gIEkMvIVz, sEx6ZvSVk")
		mr.HTTPRequest = httpreq
		_, err = tc.queryService.parseMetricRequest(context.Background(), tc.signedInUser, true, mr)
		require.NoError(t, err)
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

		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)

		require.NoError(t, err)
	})

	t.Run("can query multiple datasources with an expression present", func(t *testing.T) {
		tc := setup(t)
		// refId does get set if not included, but better to include it explicitly here
		query1, err := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				},
				"refId": "A"
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

		// without query parameter
		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)
		require.NoError(t, err)

		httpreq, _ := http.NewRequest(http.MethodPost, "http://localhost/ds/query?expression=true", bytes.NewReader([]byte{}))
		httpreq.Header.Add("X-Datasource-Uid", "gIEkMvIVz")
		reqDTO.HTTPRequest = httpreq

		// with query parameter
		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)
		require.NoError(t, err)
	})

	t.Run("error is returned when one of the queries fails", func(t *testing.T) {
		tc := setup(t)

		query1, _ := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "mysql",
					"uid": "ds1"
				}
			}
		`))
		query2, _ := simplejson.NewJson([]byte(`
			{
				"datasource": {
					"type": "prometheus",
					"uid": "ds2"
				},
				"queryType": "FAIL"
			}
		`))

		queries := []*simplejson.Json{query1, query2}

		reqDTO := dtos.MetricRequest{
			From:                       "2022-01-01",
			To:                         "2022-01-02",
			Queries:                    queries,
			Debug:                      false,
			PublicDashboardAccessToken: "abc123",
			HTTPRequest:                nil,
		}

		_, err := tc.queryService.QueryData(context.Background(), tc.signedInUser, true, reqDTO)

		require.Error(t, err)
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

		_, err := tc.queryService.QueryData(context.Background(), nil, true, metricRequest())
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
		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, metricReq)
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
		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, metricReq)
		require.NoError(t, err)

		require.Equal(t, map[string]string{"Cookie": "bar=rab; foo=oof"}, tc.pluginContext.req.Headers)
	})

	t.Run("it doesn't adds cookie header to the request when keepCookies configured with login cookie name", func(t *testing.T) {
		tc := setup(t)
		tc.queryService.cfg.LoginCookieName = "grafana_session"
		json, err := simplejson.NewJson([]byte(`{"keepCookies": [ "grafana_session", "bar" ]}`))
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
		httpReq.AddCookie(&http.Cookie{Name: tc.queryService.cfg.LoginCookieName, Value: "val"})
		metricReq.HTTPRequest = httpReq
		_, err = tc.queryService.QueryData(context.Background(), tc.signedInUser, true, metricReq)
		require.NoError(t, err)

		require.Equal(t, map[string]string{"Cookie": "bar=rab"}, tc.pluginContext.req.Headers)
	})
}

func setup(t *testing.T) *testContext {
	t.Helper()
	pc := &fakePluginClient{}
	dc := &fakeDataSourceCache{ds: &datasources.DataSource{}}
	tc := &fakeOAuthTokenService{}
	rv := &fakePluginRequestValidator{}

	sqlStore := db.InitTestDB(t)
	secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	ss := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
	ssvc := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
	quotaService := quotatest.New(false, nil)
	ds, err := dsSvc.ProvideService(nil, ssvc, ss, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewMockedPermissionsService(), quotaService)
	require.NoError(t, err)
	fakeDatasourceService := &fakeDatasources.FakeDataSourceService{
		DataSources:           nil,
		SimulatePluginFailure: false,
	}
	exprService := exprservice.ProvideService(&setting.Cfg{ExpressionsEnabled: true}, pc, fakeDatasourceService)
	queryService := ProvideService(setting.NewCfg(), dc, exprService, rv, ds, pc, tc) // provider belonging to this package
	return &testContext{
		pluginContext:          pc,
		secretStore:            ss,
		dataSourceCache:        dc,
		oauthTokenService:      tc,
		pluginRequestValidator: rv,
		queryService:           queryService,
		signedInUser:           &user.SignedInUser{OrgID: 1},
	}
}

type testContext struct {
	pluginContext          *fakePluginClient
	secretStore            secretskvs.SecretsKVStore
	dataSourceCache        *fakeDataSourceCache
	oauthTokenService      *fakeOAuthTokenService
	pluginRequestValidator *fakePluginRequestValidator
	queryService           *Service // implementation belonging to this package
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

func (ts *fakeOAuthTokenService) HasOAuthEntry(context.Context, *user.SignedInUser) (*models.UserAuth, bool, error) {
	return nil, false, nil
}

func (ts *fakeOAuthTokenService) TryTokenRefresh(context.Context, *models.UserAuth) error {
	return nil
}

func (ts *fakeOAuthTokenService) InvalidateOAuthTokens(context.Context, *models.UserAuth) error {
	return nil
}

type fakeDataSourceCache struct {
	ds *datasources.DataSource
}

func (c *fakeDataSourceCache) GetDatasource(ctx context.Context, datasourceID int64, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
	return c.ds, nil
}

func (c *fakeDataSourceCache) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *user.SignedInUser, skipCache bool) (*datasources.DataSource, error) {
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

	if req.Queries[0].QueryType == "FAIL" {
		return nil, errors.New("plugin client failed")
	}

	return &backend.QueryDataResponse{Responses: make(backend.Responses)}, nil
}
