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
		"annotations": {
			"list": [
			{
				"builtIn": 1,
				"datasource": "-- Grafana --",
				"enable": true,
				"hide": true,
				"iconColor": "rgba(0, 211, 255, 1)",
				"name": "Annotations & Alerts",
				"target": {
					"limit": 100,
					"matchAny": false,
					"tags": [],
					"type": "dashboard"
				},
				"type": "dashboard"
			}
			]
		},
		"editable": true,
		"fiscalYearStartMonth": 0,
		"graphTooltip": 0,
		"links": [],
		"liveNow": false,
		"panels": [
		{
			"fieldConfig": {
				"defaults": {
					"color": {
						"mode": "palette-classic"
					},
					"custom": {
						"axisLabel": "",
						"axisPlacement": "auto",
						"barAlignment": 0,
						"drawStyle": "line",
						"fillOpacity": 0,
						"gradientMode": "none",
						"hideFrom": {
							"legend": false,
							"tooltip": false,
							"viz": false
						},
						"lineInterpolation": "linear",
						"lineWidth": 1,
						"pointSize": 5,
						"scaleDistribution": {
							"type": "linear"
						},
						"showPoints": "auto",
						"spanNulls": false,
						"stacking": {
							"group": "A",
							"mode": "none"
						},
						"thresholdsStyle": {
							"mode": "off"
						}
					},
					"mappings": [],
					"thresholds": {
						"mode": "absolute",
						"steps": [
						{
							"color": "green",
							"value": null
						},
						{
							"color": "red",
							"value": 80
						}
						]
					}
				},
				"overrides": []
			},
			"gridPos": {
				"h": 9,
				"w": 12,
				"x": 0,
				"y": 0
			},
			"id": 2,
			"options": {
				"legend": {
					"calcs": [],
					"displayMode": "list",
					"placement": "bottom"
				},
				"tooltip": {
					"mode": "single",
					"sort": "none"
				}
			},
			"title": "Panel Title",
			"type": "timeseries"
		}
		],
		"schemaVersion": 35,
		"style": "dark",
		"tags": [],
		"templating": {
			"list": []
		},
		"time": {
			"from": "now-6h",
			"to": "now"
		},
		"timepicker": {},
		"timezone": "",
		"title": "New dashboard",
		"version": 0,
		"weekStart": ""
	}`
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

	dashboardJson, err := simplejson.NewFromReader(strings.NewReader(getDashboardByIdOutput))
	if err != nil {
		t.Fatalf("Failed to unmarshal dashboard json: %v", err)
	}

	t.Run("Can query a valid dashboard", func(t *testing.T) {
		defer bus.ClearBusHandlers()

		bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
			query.Result = &models.Dashboard{
				Id:    1,
				OrgId: testOrgID,
				Data:  dashboardJson,
			}
			return nil
		})

		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/id/%s/panels/%s/query", "1", "2"),
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
		assert.Equal(t, http.StatusBadRequest, response.Code)
	})
}

func TestAPIEndpoint_Metrics_checkDashboardAndPanel(t *testing.T) {
	dashboardJson, err := simplejson.NewFromReader(strings.NewReader(getDashboardByIdOutput))
	if err != nil {
		t.Fatalf("Failed to unmarshal dashboard json: %v", err)
	}

	type dashboardQueryResult struct {
		result *models.Dashboard
		err    error
	}
	tests := []struct {
		name                 string
		dashboardId          string
		panelId              string
		dashboardQueryResult *dashboardQueryResult
		expectedError        error
	}{
		{
			name:        "Work when correct dashboardId and panelId given",
			dashboardId: "1",
			panelId:     "2",
			dashboardQueryResult: &dashboardQueryResult{
				result: &models.Dashboard{
					Id:    1,
					OrgId: testOrgID,
					Data:  dashboardJson,
				},
			},
			expectedError: nil,
		},
		{
			name:                 "Get 404 when dashboardId not given",
			dashboardId:          "",
			panelId:              "1",
			dashboardQueryResult: nil,
			expectedError:        models.ErrDashboardOrPanelIdentifierNotSet,
		},
		{
			name:                 "Get 404 when panelId not given",
			dashboardId:          "1",
			panelId:              "",
			dashboardQueryResult: nil,
			expectedError:        models.ErrDashboardOrPanelIdentifierNotSet,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			defer bus.ClearBusHandlers()

			if test.dashboardQueryResult != nil {
				bus.AddHandler(
					"test",
					func(ctx context.Context, query *models.GetDashboardQuery) error {
						query.Result = test.dashboardQueryResult.result
						return test.dashboardQueryResult.err
					},
				)
			}

			assert.Equal(t, test.expectedError, checkDashboardAndPanel(context.Background(), test.dashboardId, test.panelId))
		})
	}

	//// TODO add happy path test
	//t.Run("Cannot query without a valid dashboard ID", func(t *testing.T) {
	//	response := callAPI(
	//		sc.server,
	//		http.MethodPost,
	//		fmt.Sprintf("/api/dashboards/id//panels/%s/query", "1"),
	//		strings.NewReader(queryDatasourceInput),
	//		t,
	//	)
	//	assert.Equal(t, http.StatusBadRequest, response.Code)
	//})

	//t.Run("Cannot query without a valid panel ID", func(t *testing.T) {
	//	response := callAPI(
	//		sc.server,
	//		http.MethodPost,
	//		fmt.Sprintf("/api/dashboards/id/%s/panels//query", "1"),
	//		strings.NewReader(queryDatasourceInput),
	//		t,
	//	)
	//	assert.Equal(t, http.StatusBadRequest, response.Code)
	//})

	//t.Run("Get 404 when dashboardId does not exist", func(t *testing.T) {
	//	defer bus.ClearBusHandlers()

	//	// stub 404 response
	//	bus.AddHandler("test", func(ctx context.Context, query *models.GetDataSourceQuery) error {
	//		//query.Result = &models.DataSource{}
	//		return models.ErrDataSourceNotFound
	//	})

	//	response := callAPI(
	//		sc.server,
	//		http.MethodPost,
	//		fmt.Sprintf("/api/dashboards/id/%s/panels/%s/query", "1", "A"),
	//		strings.NewReader(queryDatasourceInput),
	//		t,
	//	)
	//	assert.Equal(t, http.StatusNotFound, response.Code)
	//})

	//t.Run("Get 404 when panelId does not exist", func(t *testing.T) {
	//	defer bus.ClearBusHandlers()

	//	bus.AddHandler("test", func(ctx context.Context, query *models.GetDashboardQuery) error {
	//		query.Result = &models.Dashboard{
	//			Id:    1,
	//			OrgId: testOrgID,
	//			Data:  dashboardJson,
	//		}
	//		return nil
	//	})

	//	response := callAPI(
	//		sc.server,
	//		http.MethodPost,
	//		fmt.Sprintf("/api/dashboards/id/%s/panels/%s/query", "1", "x"),
	//		strings.NewReader(queryDatasourceInput),
	//		t,
	//	)
	//	assert.Equal(t, http.StatusNotFound, response.Code)
	//})
}
