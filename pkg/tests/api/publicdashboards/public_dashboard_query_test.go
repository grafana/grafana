package publicdashboards

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestPublicDashboardQueryAPI(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagPublicDashboardsEmailSharing,
		},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	adminUsername := fmt.Sprintf("testadmin-%d", time.Now().UnixNano())
	tests.CreateUser(t, env.SQLStore, env.Cfg, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Login:          adminUsername,
		Password:       "admin",
		IsAdmin:        true,
	})
	adminClient := createHTTPClient(grafanaListedAddr, adminUsername, "admin")

	datasourcePayload := map[string]any{
		"name":   "Test Data Source",
		"type":   datasources.DS_TESTDATA,
		"uid":    "testdata",
		"access": "proxy",
	}
	datasourceBytes, err := json.Marshal(datasourcePayload)
	require.NoError(t, err)
	var datasourceResult map[string]any
	createDatasourceResp := doRequest(t, adminClient, "POST", "/api/datasources", datasourceBytes, &datasourceResult)
	require.Equal(t, 200, createDatasourceResp.StatusCode)

	t.Run("unauthenticated user can query public dashboard panel", func(t *testing.T) {
		// create dashboard first
		dashboardPayload := map[string]any{
			"dashboard": map[string]any{
				"title": "Test Dashboard for Query",
				"time": map[string]any{
					"from": "now-1h",
					"to":   "now",
				},
				"panels": []map[string]any{
					{
						"id":    1,
						"type":  "stat",
						"title": "Test Panel",
						"targets": []map[string]any{
							{
								"refId":      "A",
								"scenarioId": "random_walk",
								"datasource": map[string]any{
									"type": datasources.DS_TESTDATA,
									"uid":  "testdata",
								},
							},
						},
					},
				},
			},
			"folderUid": "",
			"overwrite": false,
		}
		payloadBytes, err := json.Marshal(dashboardPayload)
		require.NoError(t, err)
		var dashboardResult map[string]any
		createDashboardResp := doRequest(t, adminClient, "POST", "/api/dashboards/db", payloadBytes, &dashboardResult)
		require.Equal(t, 200, createDashboardResp.StatusCode)

		// make it public
		dashboardUID := dashboardResult["uid"].(string)
		publicDashboardPayload := map[string]any{
			"isEnabled":            true,
			"annotationsEnabled":   false,
			"timeSelectionEnabled": false,
			"share":                "public",
		}
		payloadBytes, err = json.Marshal(publicDashboardPayload)
		require.NoError(t, err)
		createURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID)
		var publicDashboard map[string]any
		createResp := doRequest(t, adminClient, "POST", createURL, payloadBytes, &publicDashboard)
		require.Equal(t, 200, createResp.StatusCode)
		assert.Equal(t, true, publicDashboard["isEnabled"])
		assert.NotEmpty(t, publicDashboard["accessToken"])

		// test unauthenticated query to the public dashboard panel
		accessToken := publicDashboard["accessToken"].(string)
		queryPayload := map[string]any{}
		queryBytes, err := json.Marshal(queryPayload)
		require.NoError(t, err)
		queryURL := fmt.Sprintf("/api/public/dashboards/%s/panels/1/query", accessToken)
		unauthenticatedClient := createUnauthenticatedClient(grafanaListedAddr)

		var queryResult map[string]any
		doRequest(t, unauthenticatedClient, "POST", queryURL, queryBytes, &queryResult)
		assert.NotNil(t, queryResult["results"])
		results := queryResult["results"].(map[string]any)
		assert.NotNil(t, results["A"])
	})

	t.Run("unauthenticated user cannot query disabled public dashboard", func(t *testing.T) {
		// create the dashboard
		dashboardPayload := map[string]any{
			"dashboard": map[string]any{
				"title": "Test Disabled Dashboard",
				"time": map[string]any{
					"from": "now-1h",
					"to":   "now",
				},
				"panels": []map[string]any{
					{
						"id":    1,
						"type":  "stat",
						"title": "Test Panel",
					},
				},
			},
			"folderUid": "",
			"overwrite": false,
		}
		payloadBytes, err := json.Marshal(dashboardPayload)
		require.NoError(t, err)
		var dashboardResult map[string]any
		createDashboardResp := doRequest(t, adminClient, "POST", "/api/dashboards/db", payloadBytes, &dashboardResult)
		require.Equal(t, 200, createDashboardResp.StatusCode)

		// make it a disabled public dashboard
		dashboardUID := dashboardResult["uid"].(string)
		publicDashboardPayload := map[string]any{
			"isEnabled":            false,
			"annotationsEnabled":   false,
			"timeSelectionEnabled": true,
			"share":                "public",
		}
		payloadBytes, err = json.Marshal(publicDashboardPayload)
		require.NoError(t, err)
		createURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID)
		var publicDashboard map[string]any
		createResp := doRequest(t, adminClient, "POST", createURL, payloadBytes, &publicDashboard)
		require.Equal(t, 200, createResp.StatusCode)
		assert.Equal(t, false, publicDashboard["isEnabled"])
		assert.NotEmpty(t, publicDashboard["accessToken"])

		accessToken := publicDashboard["accessToken"].(string)

		queryPayload := map[string]any{
			"intervalMs":    1000,
			"maxDataPoints": 100,
			"timeRange": map[string]any{
				"from": "now-1h",
				"to":   "now",
			},
		}
		queryBytes, err := json.Marshal(queryPayload)
		require.NoError(t, err)

		// should not be able to query anymore
		queryURL := fmt.Sprintf("/api/public/dashboards/%s/panels/1/query", accessToken)
		unauthenticatedClient := createUnauthenticatedClient(grafanaListedAddr)
		var queryResult map[string]any
		queryResp := doRequest(t, unauthenticatedClient, "POST", queryURL, queryBytes, &queryResult)
		require.Equal(t, 403, queryResp.StatusCode)
		require.Nil(t, queryResult["results"])
	})
}

func createUnauthenticatedClient(host string) *httpClient {
	baseURL := fmt.Sprintf("http://%s", host)
	return &httpClient{
		baseURL: baseURL,
		client: &http.Client{
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}
