package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"testing"

	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/mockstore"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	datasources "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/query"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/stretchr/testify/assert"
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

func (c *dashboardFakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	c.req = req
	resp := backend.Responses{}
	return &backend.QueryDataResponse{Responses: resp}, nil
}

type dashboardFakePluginClient struct {
	plugins.Client

	req *backend.QueryDataRequest
}

// `/dashboards/org/:orgId/uid/:dashboardUid/panels/:panelId/query` endpoints test
func TestAPIEndpoint_Metrics_QueryMetricsFromDashboard(t *testing.T) {
	sc := setupHTTPServerWithMockDb(t, false, false)

	secretsStore := kvstore.SetupTestService(t)
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	ds := datasources.ProvideService(nil, secretsService, secretsStore, nil, featuremgmt.WithFeatures(), acmock.New(), acmock.NewPermissionsServicesMock())

	setInitCtxSignedInViewer(sc.initCtx)
	sc.hs.queryDataService = query.ProvideService(
		nil,
		nil,
		nil,
		&fakePluginRequestValidator{},
		ds,
		&dashboardFakePluginClient{},
		&fakeOAuthTokenService{},
	)

	sc.hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagValidatedQueries, true)

	dashboardJson, err := simplejson.NewFromReader(strings.NewReader(getDashboardByIdOutput))
	if err != nil {
		t.Fatalf("Failed to unmarshal dashboard json: %v", err)
	}

	mockDb := sc.hs.SQLStore.(*mockstore.SQLStoreMock)

	t.Run("Can query a valid dashboard", func(t *testing.T) {
		mockDb.ExpectedDashboard = &models.Dashboard{
			Uid:   "1",
			OrgId: testOrgID,
			Data:  dashboardJson,
		}
		mockDb.ExpectedError = nil

		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/org/%d/uid/%s/panels/%s/query", testOrgID, "1", "2"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusOK, response.Code)
	})

	t.Run("Cannot query without a valid orgid or dashboard or panel ID", func(t *testing.T) {
		mockDb.ExpectedDashboard = nil
		mockDb.ExpectedError = models.ErrDashboardOrPanelIdentifierNotSet

		response := callAPI(
			sc.server,
			http.MethodPost,
			"/api/dashboards/org//uid//panels//query",
			strings.NewReader(queryDatasourceInput),
			t,
		)

		assert.Equal(t, http.StatusBadRequest, response.Code)

		var res map[string]interface{}
		err := json.Unmarshal(response.Body.Bytes(), &res)
		assert.NoError(t, err)
		assert.Equal(t, models.ErrDashboardOrPanelIdentifierNotSet.Error(), res["error"])
		assert.Equal(t, models.ErrDashboardOrPanelIdentifierNotSet.Error(), res["message"])
	})

	t.Run("Cannot query without a valid orgid", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/org//uid/%s/panels/%s/query", "1", "2"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusBadRequest, response.Code)
		var res map[string]interface{}
		assert.NoError(t, json.Unmarshal(response.Body.Bytes(), &res))
		assert.Equal(t, models.ErrDashboardOrPanelIdentifierNotSet.Error(), res["error"])
		assert.Equal(t, models.ErrDashboardOrPanelIdentifierNotSet.Error(), res["message"])
	})

	t.Run("Cannot query without a valid dashboard or panel ID", func(t *testing.T) {
		response := callAPI(
			sc.server,
			http.MethodPost,
			fmt.Sprintf("/api/dashboards/org//uid/%s/panels/%s/query", "1", "2"),
			strings.NewReader(queryDatasourceInput),
			t,
		)
		assert.Equal(t, http.StatusBadRequest, response.Code)

		var res map[string]interface{}
		assert.NoError(t, json.Unmarshal(response.Body.Bytes(), &res))
		assert.Equal(t, models.ErrDashboardOrPanelIdentifierNotSet.Error(), res["error"])
		assert.Equal(t, models.ErrDashboardOrPanelIdentifierNotSet.Error(), res["message"])
	})

	t.Run("Cannot query when ValidatedQueries is disabled", func(t *testing.T) {
		sc.hs.Features = featuremgmt.WithFeatures(featuremgmt.FlagValidatedQueries, false)

		response := callAPI(
			sc.server,
			http.MethodPost,
			"/api/dashboards/uid/1/panels/1/query",
			strings.NewReader(queryDatasourceInput),
			t,
		)

		assert.Equal(t, http.StatusNotFound, response.Code)
		assert.Equal(
			t,
			"404 page not found\n",
			response.Body.String(),
		)
	})
}

func TestAPIEndpoint_Metrics_checkDashboardAndPanel(t *testing.T) {
	dashboardJson, err := simplejson.NewFromReader(strings.NewReader(getDashboardByIdOutput))
	if err != nil {
		t.Fatalf("Failed to unmarshal dashboard json: %v", err)
	}

	tests := []struct {
		name                 string
		orgId                int64
		dashboardUid         string
		panelId              int64
		dashboardQueryResult *models.Dashboard
		expectedError        error
	}{
		{
			name:         "Work when correct dashboardId and panelId given",
			orgId:        testOrgID,
			dashboardUid: "1",
			panelId:      2,
			dashboardQueryResult: &models.Dashboard{
				Uid:   "1",
				OrgId: testOrgID,
				Data:  dashboardJson,
			},
			expectedError: nil,
		},
		{
			name:                 "404 on invalid orgId",
			orgId:                7,
			dashboardUid:         "1",
			panelId:              2,
			dashboardQueryResult: nil,
			expectedError:        models.ErrDashboardNotFound,
		},
		{
			name:                 "404 on invalid dashboardId",
			orgId:                testOrgID,
			dashboardUid:         "",
			panelId:              2,
			dashboardQueryResult: nil,
			expectedError:        models.ErrDashboardNotFound,
		},
		{
			name:                 "404 on invalid panelId",
			orgId:                testOrgID,
			dashboardUid:         "1",
			panelId:              0,
			dashboardQueryResult: nil,
			expectedError:        models.ErrDashboardNotFound,
		},
		{
			name:                 "Fails when the dashboard does not exist",
			orgId:                testOrgID,
			dashboardUid:         "1",
			panelId:              2,
			dashboardQueryResult: nil,
			expectedError:        models.ErrDashboardNotFound,
		},
		{
			name:         "Fails when the panel does not exist",
			orgId:        testOrgID,
			dashboardUid: "1",
			panelId:      3,
			dashboardQueryResult: &models.Dashboard{
				Id:    1,
				OrgId: testOrgID,
				Data:  dashboardJson,
			},
			expectedError: models.ErrDashboardPanelNotFound,
		},
		{
			name:         "Fails when the dashboard contents are nil",
			orgId:        testOrgID,
			dashboardUid: "1",
			panelId:      3,
			dashboardQueryResult: &models.Dashboard{
				Uid:   "1",
				OrgId: testOrgID,
				Data:  nil,
			},
			expectedError: models.ErrDashboardCorrupt,
		},
	}

	ss := mockstore.NewSQLStoreMock()
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ss.ExpectedDashboard = test.dashboardQueryResult
			ss.ExpectedError = test.expectedError

			query := models.GetDashboardQuery{
				OrgId: test.orgId,
				Uid:   test.dashboardUid,
			}

			assert.Equal(t, test.expectedError, checkDashboardAndPanel(context.Background(), ss, query, test.panelId))
		})
	}
}

func TestAPIEndpoint_Metrics_ParseDashboardQueryParams(t *testing.T) {
	tests := []struct {
		name                   string
		params                 map[string]string
		expectedDashboardQuery models.GetDashboardQuery
		expectedPanelId        int64
		expectedError          error
	}{
		{
			name: "Work when correct orgId, dashboardId and panelId given",
			params: map[string]string{
				":orgId":        strconv.FormatInt(testOrgID, 10),
				":dashboardUid": "1",
				":panelId":      "2",
			},
			expectedDashboardQuery: models.GetDashboardQuery{
				Uid:   "1",
				OrgId: 1,
			},
			expectedPanelId: 2,
			expectedError:   nil,
		},
		{
			name: "Get error when dashboardUid not given",
			params: map[string]string{
				":orgId":        strconv.FormatInt(testOrgID, 10),
				":dashboardUid": "",
				":panelId":      "1",
			},
			expectedDashboardQuery: models.GetDashboardQuery{},
			expectedPanelId:        0,
			expectedError:          models.ErrDashboardOrPanelIdentifierNotSet,
		},
		{
			name: "Get error when panelId not given",
			params: map[string]string{
				":orgId":        strconv.FormatInt(testOrgID, 10),
				":dashboardUid": "1",
				":panelId":      "",
			},
			expectedDashboardQuery: models.GetDashboardQuery{},
			expectedPanelId:        0,
			expectedError:          models.ErrDashboardOrPanelIdentifierNotSet,
		},
		{
			name: "Get error when orgId not given",
			params: map[string]string{
				":orgId":        "",
				":dashboardUid": "1",
				":panelId":      "2",
			},
			expectedDashboardQuery: models.GetDashboardQuery{},
			expectedPanelId:        0,
			expectedError:          models.ErrDashboardOrPanelIdentifierNotSet,
		},
		{
			name: "Get error when panelId not is invalid",
			params: map[string]string{
				":orgId":        strconv.FormatInt(testOrgID, 10),
				":dashboardUid": "1",
				":panelId":      "aaa",
			},
			expectedDashboardQuery: models.GetDashboardQuery{},
			expectedPanelId:        0,
			expectedError:          models.ErrDashboardPanelIdentifierInvalid,
		},
		{
			name: "Get error when orgId not is invalid",
			params: map[string]string{
				":orgId":        "aaa",
				":dashboardUid": "1",
				":panelId":      "2",
			},
			expectedDashboardQuery: models.GetDashboardQuery{},
			expectedPanelId:        0,
			expectedError:          models.ErrDashboardPanelIdentifierInvalid,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			// other validations?
			dashboardQuery, panelId, err := parseDashboardQueryParams(test.params)
			assert.Equal(t, test.expectedDashboardQuery, dashboardQuery)
			assert.Equal(t, test.expectedPanelId, panelId)
			assert.Equal(t, test.expectedError, err)
		})
	}
}
