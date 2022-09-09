package query_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestQueryData(t *testing.T) {
	t.Run("it attaches custom headers to the request", func(t *testing.T) {
		tc := setup()
		tc.dataSourceCache.ds.JsonData = simplejson.NewFromAny(map[string]interface{}{"httpHeaderName1": "foo", "httpHeaderName2": "bar"})
		tc.secretService.decryptedJson = map[string]string{"httpHeaderValue1": "test-header", "httpHeaderValue2": "test-header2"}

		_, err := tc.queryService.QueryData(context.Background(), nil, true, metricRequest(), false)
		require.Nil(t, err)

		require.Equal(t, map[string]string{"foo": "test-header", "bar": "test-header2"}, tc.pluginContext.req.Headers)
	})

	t.Run("it auth custom headers to the request", func(t *testing.T) {
		token := &oauth2.Token{
			TokenType:   "bearer",
			AccessToken: "access-token",
		}
		token = token.WithExtra(map[string]interface{}{"id_token": "id-token"})

		tc := setup()
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
}

func setup() *testContext {
	pc := &fakePluginClient{}
	sc := &fakeSecretsService{}
	dc := &fakeDataSourceCache{ds: &models.DataSource{}}
	tc := &fakeOAuthTokenService{}
	rv := &fakePluginRequestValidator{}

	return &testContext{
		pluginContext:          pc,
		secretService:          sc,
		dataSourceCache:        dc,
		oauthTokenService:      tc,
		pluginRequestValidator: rv,
		queryService:           query.ProvideService(setting.NewCfg(), dc, nil, rv, sc, pc, tc),
	}
}

type testContext struct {
	pluginContext          *fakePluginClient
	secretService          *fakeSecretsService
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

func (c *fakeDataSourceCache) GetDatasource(ctx context.Context, datasourceID int64, user *models.SignedInUser, skipCache bool) (*models.DataSource, error) {
	return c.ds, nil
}

func (c *fakeDataSourceCache) GetDatasourceByUID(ctx context.Context, datasourceUID string, user *models.SignedInUser, skipCache bool) (*models.DataSource, error) {
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
