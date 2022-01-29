package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var (
	queryDatasourceInput = `{
		"from": "",
		"to": "",
		"queries": [
			{
				"datasource": {
					"type": "datasource",
					"uid": "grafana"
				},
				"queryType": "randomWalk",
				"refId": "A"
			}
		]
	}`

	getDashboardByIdOutput = `{
		"results": {
			"A": {
				"frames": [
				{
					"schema": {
						"refId": "A",
						"fields": [
						{
							"name": "time",
							"type": "time",
							"typeInfo": {
								"frame": "time.Time",
								"nullable": true
							}
						},
						{
							"name": "A-series",
							"type": "number",
							"typeInfo": {
								"frame": "float64",
								"nullable": true
							},
							"labels": {}
						}
						]
					},
					"data": { "values": [ [ ], [] ] }
				}
				]
			}
		}
	}`

	testDataSource = models.DataSource{
		Id:     3,
		Uid:    "testUID",
		OrgId:  testOrgID,
		Name:   "test",
		Url:    "http://localhost:5432",
		Type:   "postgresql",
		Access: "Proxy",
		JsonData: simplejson.NewFromAny(map[string]interface{}{
			"jsonDataKey": "jsonDataValue",
		}),
	}
)

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

type fakePluginClient struct {
	plugins.Client

	req *backend.QueryDataRequest
}

func (c *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	c.req = req
	return &backend.QueryDataResponse{Responses: map[string]backend.DataResponse{}}, nil
}

// `/api/dashboards/:dashboardId/panels/:panelId` endpoints test
func TestAPIEndpoint_Metrics_QueryMetricsFromDashboard(t *testing.T) {
	sc := setupHTTPServer(t, false, false)
	setInitCtxSignedInViewer(sc.initCtx)
	sc.hs.queryDataService = query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		fakes.NewFakeSecretsService(),
		&fakePluginClient{},
		&fakeOAuthTokenService{},
	)

	_, err := sc.db.CreateOrgWithMember("TestOrg", testUserID)
	require.NoError(t, err)

	dashboardJson, _ := simplejson.NewFromReader(strings.NewReader(getDashboardByIdOutput))

	t.Run("Can query a valid dashboard", func(t *testing.T) {
		defer bus.ClearBusHandlers()

		bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardsQuery) error {
			query.Result = &models.Dashboard{
				Id:       1,
				OrgId:    testOrgID,
				Name:     "test",
				Url:      "http://localhost:5432",
				Type:     "postgresql",
				Access:   "Proxy",
				JsonData: dashboardJson,
			}
			return nil
		})

		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/id/%s/panels/%s/query", "1", "A"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("Cannot query without a valid dashboard or panel ID", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			"/api/dashboards/id//panels//query",
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("Cannot query without a valid dashboard ID", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/id//panels/%s/query", "1"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("Cannot query without a valid panel ID", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/id/%s/panels//query", "1"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusForbidden, response.Code)
	})

	t.Run("Get 404 when dashboardId does not exist", func(t *testing.T) {
		defer bus.ClearBusHandlers()

		// stub 404 response
		bus.AddHandler("test", func(ctx context.Context, query *models.GetDataSourceQuery) error {
			//query.Result = &models.DataSource{}
			return models.ErrDataSourceNotFound
		})

		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/id/%s/panels/%s/query", "1", "A"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusNotFound, response.Code)
	})

	t.Run("Get 404 when panelId does not exist", func(t *testing.T) {
		defer bus.ClearBusHandlers()

		bus.AddHandler("test", func(ctx context.Context, query *models.GetDataSourceQuery) error {
			query.Result = &models.DataSource{
				Id:       1,
				OrgId:    testOrgID,
				Name:     "test",
				Url:      "http://localhost:5432",
				Type:     "postgresql",
				Access:   "Proxy",
				JsonData: dashboardJson,
			}
			return nil
		})

		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/id/%s/panels/%s/query", "1", "x"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusNotFound, response.Code)
	})
}
