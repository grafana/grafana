package query_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	datasources "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"

	"github.com/stretchr/testify/require"
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
}

func setup(t *testing.T) *testContext {
	pc := &fakePluginClient{}
	dc := &fakeDataSourceCache{ds: &models.DataSource{}}
	tc := &fakeOAuthTokenService{}
	rv := &fakePluginRequestValidator{}

	ss := kvstore.SetupTestService(t)
	ssvc := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	ds := datasources.ProvideService(nil, ssvc, ss, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewPermissionsServicesMock())

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
	secretStore            kvstore.SecretsKVStore
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
