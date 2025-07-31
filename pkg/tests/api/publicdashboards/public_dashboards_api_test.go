package publicdashboards

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestPublicDashboardsAPI(t *testing.T) {
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		AppModeProduction: false,
		EnableFeatureToggles: []string{
			featuremgmt.FlagPublicDashboardsEmailSharing,
		},
	})

	grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
	adminUsername := fmt.Sprintf("testadmin-%d", time.Now().UnixNano())
	tests.CreateUser(t, env.SQLStore, env.SettingsProvider, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Login:          adminUsername,
		Password:       "admin",
		IsAdmin:        true,
	})
	adminClient := createHTTPClient(grafanaListedAddr, adminUsername, "admin")

	t.Run("should create, get, update, and delete public dashboard", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Test Dashboard",
				"panels": []map[string]interface{}{
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

		var dashboardResult map[string]interface{}
		createDashboardResp := doRequest(t, adminClient, "POST", "/api/dashboards/db", payloadBytes, &dashboardResult)
		require.Equal(t, 200, createDashboardResp.StatusCode)

		dashboardUID := dashboardResult["uid"].(string)

		var listResult map[string]interface{}
		doRequest(t, adminClient, "GET", "/api/dashboards/public-dashboards", nil, &listResult)
		publicDashboardPayload := map[string]interface{}{
			"isEnabled":            true,
			"annotationsEnabled":   false,
			"timeSelectionEnabled": true,
			"share":                "public",
		}

		payloadBytes, err = json.Marshal(publicDashboardPayload)
		require.NoError(t, err)

		createURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID)
		var publicDashboard map[string]interface{}
		createResp := doRequest(t, adminClient, "POST", createURL, payloadBytes, &publicDashboard)
		require.Equal(t, 200, createResp.StatusCode)
		assert.Equal(t, true, publicDashboard["isEnabled"])
		assert.Equal(t, false, publicDashboard["annotationsEnabled"])
		assert.Equal(t, true, publicDashboard["timeSelectionEnabled"])
		assert.Equal(t, "public", publicDashboard["share"])
		assert.NotEmpty(t, publicDashboard["accessToken"])
		assert.NotEmpty(t, publicDashboard["uid"])

		accessToken := publicDashboard["accessToken"].(string)
		publicDashboardUID := publicDashboard["uid"].(string)

		// get the public dashboard
		getURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID)
		var retrievedPD map[string]interface{}
		getResp := doRequest(t, adminClient, "GET", getURL, nil, &retrievedPD)
		require.Equal(t, 200, getResp.StatusCode)

		// view the public dashboard
		viewURL := fmt.Sprintf("/api/public/dashboards/%s", accessToken)
		var dashboardData map[string]interface{}
		viewResp := doRequest(t, adminClient, "GET", viewURL, nil, &dashboardData)
		require.Equal(t, 200, viewResp.StatusCode)
		assert.Equal(t, "Test Dashboard", dashboardData["dashboard"].(map[string]interface{})["title"])
		assert.Equal(t, "Test Panel", dashboardData["dashboard"].(map[string]interface{})["panels"].([]interface{})[0].(map[string]interface{})["title"])

		updatePayload := map[string]interface{}{
			"isEnabled":            false,
			"annotationsEnabled":   true,
			"timeSelectionEnabled": false,
			"share":                "email",
		}
		updateBytes, err := json.Marshal(updatePayload)
		require.NoError(t, err)
		updateURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards/%s", dashboardUID, publicDashboardUID)
		var updatedPD map[string]interface{}
		updateResp := doRequest(t, adminClient, "PATCH", updateURL, updateBytes, &updatedPD)
		require.Equal(t, 200, updateResp.StatusCode)
		assert.Equal(t, false, updatedPD["isEnabled"])
		assert.Equal(t, true, updatedPD["annotationsEnabled"])
		assert.Equal(t, false, updatedPD["timeSelectionEnabled"])
		assert.Equal(t, "email", updatedPD["share"])

		deleteURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards/%s", dashboardUID, publicDashboardUID)
		var deleteResult map[string]interface{}
		deleteResp := doRequest(t, adminClient, "DELETE", deleteURL, nil, &deleteResult)
		require.Equal(t, 200, deleteResp.StatusCode)
		var getAfterDeleteResult map[string]interface{}
		getAfterDeleteResp := doRequest(t, adminClient, "GET", getURL, nil, &getAfterDeleteResult)
		require.Equal(t, 404, getAfterDeleteResp.StatusCode)
	})

	t.Run("should list public dashboards", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Test Dashboard for List",
				"panels": []map[string]interface{}{
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

		var dashboardResult map[string]interface{}
		createDashboardResp := doRequest(t, adminClient, "POST", "/api/dashboards/db", payloadBytes, &dashboardResult)
		require.Equal(t, 200, createDashboardResp.StatusCode)
		dashboardUID := dashboardResult["uid"].(string)

		publicDashboardPayload := map[string]interface{}{
			"isEnabled":            true,
			"annotationsEnabled":   false,
			"timeSelectionEnabled": true,
			"share":                "public",
		}

		payloadBytes, err = json.Marshal(publicDashboardPayload)
		require.NoError(t, err)

		createURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID)
		var createResult map[string]interface{}
		createResp := doRequest(t, adminClient, "POST", createURL, payloadBytes, &createResult)
		require.Equal(t, 200, createResp.StatusCode)

		var listData map[string]interface{}
		listResp := doRequest(t, adminClient, "GET", "/api/dashboards/public-dashboards", nil, &listData)
		require.Equal(t, 200, listResp.StatusCode)
		assert.NotEmpty(t, listData["publicDashboards"])
		publicDashboards := listData["publicDashboards"].([]interface{})
		assert.GreaterOrEqual(t, len(publicDashboards), 1)
	})

	t.Run("should handle invalid access token", func(t *testing.T) {
		var viewResult map[string]interface{}
		viewResp := doRequest(t, adminClient, "GET", "/api/public/dashboards/invalid-token", nil, &viewResult)
		require.Equal(t, 400, viewResp.StatusCode)
	})

	t.Run("should handle disabled public dashboard", func(t *testing.T) {
		dashboardPayload := map[string]interface{}{
			"dashboard": map[string]interface{}{
				"title": "Test Dashboard Disabled",
				"panels": []map[string]interface{}{
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

		var dashboardResult map[string]interface{}
		createDashboardResp := doRequest(t, adminClient, "POST", "/api/dashboards/db", payloadBytes, &dashboardResult)
		require.Equal(t, 200, createDashboardResp.StatusCode)

		dashboardUID := dashboardResult["uid"].(string)
		publicDashboardPayload := map[string]interface{}{
			"isEnabled":            false,
			"annotationsEnabled":   false,
			"timeSelectionEnabled": true,
			"share":                "public",
		}

		payloadBytes, err = json.Marshal(publicDashboardPayload)
		require.NoError(t, err)

		createURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUID)
		var publicDashboard map[string]interface{}
		createResp := doRequest(t, adminClient, "POST", createURL, payloadBytes, &publicDashboard)
		require.Equal(t, 200, createResp.StatusCode)
		accessToken := publicDashboard["accessToken"].(string)

		var viewResult map[string]interface{}
		viewResp := doRequest(t, adminClient, "GET", fmt.Sprintf("/api/public/dashboards/%s", accessToken), nil, &viewResult)
		require.Equal(t, 403, viewResp.StatusCode)
	})

	t.Run("permission test", func(t *testing.T) {
		dashboards := []map[string]interface{}{
			{
				"dashboard": map[string]interface{}{
					"title": "test",
					"uid":   "9S6TmO67z",
					"panels": []map[string]interface{}{
						{
							"id":    1,
							"type":  "stat",
							"title": "Test Panel",
						},
					},
				},
				"folderUid": "",
				"overwrite": false,
			},
			{
				"dashboard": map[string]interface{}{
					"title": "my first dashboard",
					"uid":   "1S6TmO67z",
					"panels": []map[string]interface{}{
						{
							"id":    1,
							"type":  "stat",
							"title": "Test Panel",
						},
					},
				},
				"folderUid": "",
				"overwrite": false,
			},
			{
				"dashboard": map[string]interface{}{
					"title": "my second dashboard",
					"uid":   "2S6TmO67z",
					"panels": []map[string]interface{}{
						{
							"id":    1,
							"type":  "stat",
							"title": "Test Panel",
						},
					},
				},
				"folderUid": "",
				"overwrite": false,
			},
			{
				"dashboard": map[string]interface{}{
					"title": "my zero dashboard",
					"uid":   "0S6TmO67z",
					"panels": []map[string]interface{}{
						{
							"id":    1,
							"type":  "stat",
							"title": "Test Panel",
						},
					},
				},
				"folderUid": "",
				"overwrite": false,
			},
		}

		dashboardUIDs := make([]string, len(dashboards))
		publicDashboardUIDs := make([]string, len(dashboards))

		for i, dashboardPayload := range dashboards {
			payloadBytes, err := json.Marshal(dashboardPayload)
			require.NoError(t, err)

			var dashboardResult map[string]interface{}
			createDashboardResp := doRequest(t, adminClient, "POST", "/api/dashboards/db", payloadBytes, &dashboardResult)
			require.Equal(t, 200, createDashboardResp.StatusCode)
			dashboardUIDs[i] = dashboardResult["uid"].(string)

			isEnabled := i != 1
			publicDashboardPayload := map[string]interface{}{
				"isEnabled":            isEnabled,
				"annotationsEnabled":   false,
				"timeSelectionEnabled": true,
				"share":                "public",
			}

			payloadBytes, err = json.Marshal(publicDashboardPayload)
			require.NoError(t, err)

			createURL := fmt.Sprintf("/api/dashboards/uid/%s/public-dashboards", dashboardUIDs[i])
			var publicDashboard map[string]interface{}
			createResp := doRequest(t, adminClient, "POST", createURL, payloadBytes, &publicDashboard)
			require.Equal(t, 200, createResp.StatusCode)
			publicDashboardUIDs[i] = publicDashboard["uid"].(string)
		}

		t.Run("admin user should see all dashboards", func(t *testing.T) {
			var listData map[string]interface{}
			listResp := doRequest(t, adminClient, "GET", "/api/dashboards/public-dashboards?page=1&perpage=50", nil, &listData)
			require.Equal(t, 200, listResp.StatusCode)

			totalCount := int64(listData["totalCount"].(float64))
			assert.GreaterOrEqual(t, totalCount, int64(4))
		})

		t.Run("user with access to just one dashboard should see only that dashboard", func(t *testing.T) {
			limitedUserUsername := fmt.Sprintf("limiteduser-%d", time.Now().UnixNano())
			limitedUserID := tests.CreateUser(t, env.SQLStore, env.SettingsProvider, user.CreateUserCommand{
				DefaultOrgRole: string(org.RoleNone),
				Login:          limitedUserUsername,
				Password:       "password",
				IsAdmin:        false,
			})
			limitedUserClient := createHTTPClient(grafanaListedAddr, limitedUserUsername, "password")
			permissionPayload := map[string]interface{}{
				"permission": "View",
			}
			permissionBytes, err := json.Marshal(permissionPayload)
			require.NoError(t, err)

			permissionURL := fmt.Sprintf("/api/access-control/dashboards/9S6TmO67z/users/%d", limitedUserID)
			var permissionResult map[string]interface{}
			permissionResp := doRequest(t, adminClient, "POST", permissionURL, permissionBytes, &permissionResult)
			require.Equal(t, 200, permissionResp.StatusCode)

			var listData map[string]interface{}
			listResp := doRequest(t, limitedUserClient, "GET", "/api/dashboards/public-dashboards?page=1&perpage=50", nil, &listData)
			require.Equal(t, 200, listResp.StatusCode)

			totalCount := int64(listData["totalCount"].(float64))
			assert.Equal(t, int64(1), totalCount)
		})

		t.Run("pagination should work correctly", func(t *testing.T) {
			var listData map[string]interface{}
			listResp := doRequest(t, adminClient, "GET", "/api/dashboards/public-dashboards?page=1&perpage=2", nil, &listData)
			require.Equal(t, 200, listResp.StatusCode)
			assert.NotEmpty(t, listData["publicDashboards"])
			publicDashboards := listData["publicDashboards"].([]interface{})
			assert.Equal(t, 2, len(publicDashboards))
			totalCount := int64(listData["totalCount"].(float64))
			assert.GreaterOrEqual(t, totalCount, int64(4))

			var listDataPage2 map[string]interface{}
			listRespPage2 := doRequest(t, adminClient, "GET", "/api/dashboards/public-dashboards?page=2&perpage=2", nil, &listDataPage2)
			require.Equal(t, 200, listRespPage2.StatusCode)
			publicDashboardsPage2 := listDataPage2["publicDashboards"].([]interface{})
			assert.Equal(t, 2, len(publicDashboardsPage2))
		})
	})
}

type httpClient struct {
	baseURL string
	client  *http.Client
}

func createHTTPClient(host, username, password string) *httpClient {
	baseURL := fmt.Sprintf("http://%s:%s@%s", username, password, host)
	return &httpClient{
		baseURL: baseURL,
		client: &http.Client{
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

type httpResponse struct {
	StatusCode int
	Body       []byte
}

func doRequest(t *testing.T, client *httpClient, method, path string, body []byte, result interface{}) httpResponse {
	t.Helper()

	var req *http.Request
	var err error

	url := client.baseURL + path
	if body != nil {
		req, err = http.NewRequest(method, url, bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, err = http.NewRequest(method, url, nil)
	}
	require.NoError(t, err)

	resp, err := client.client.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close() // nolint:errcheck

	respBody, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	response := httpResponse{
		StatusCode: resp.StatusCode,
		Body:       respBody,
	}

	if result != nil && len(respBody) > 0 {
		err = json.Unmarshal(respBody, result)
		require.NoError(t, err)
	}

	return response
}
