package dashboards

// This file has all the tests for the compatibility between the Grafana API and the Grafana App Platform API

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIntegrationCompatibility(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	grafanaConfigs := []struct {
		name                 string
		unifiedStorageConfig setting.UnifiedStorageConfig
	}{
		{
			name: "Mode1",
			unifiedStorageConfig: setting.UnifiedStorageConfig{
				DualWriterMode: rest.Mode1,
			},
		},
		{
			name: "Mode2",
			unifiedStorageConfig: setting.UnifiedStorageConfig{
				DualWriterMode: rest.Mode2,
			},
		},
		{
			name: "Mode3",
			unifiedStorageConfig: setting.UnifiedStorageConfig{
				DualWriterMode: rest.Mode3,
			},
		},
	}

	var DASHBOARD_GVR = schema.GroupVersionResource{
		Group:    "dashboard.grafana.app",
		Version:  "v0alpha1",
		Resource: "dashboards",
	}

	var DASHBOARD_RESOURCEGROUP = DASHBOARD_GVR.GroupResource().String()

	var FOLDERS_GVR = schema.GroupVersionResource{
		Group:    "folder.grafana.app",
		Version:  "v0alpha1",
		Resource: "folders",
	}

	var FOLDERS_RESOURCEGROUP = FOLDERS_GVR.GroupResource().String()

	for _, tt := range grafanaConfigs {
		t.Run(tt.name, func(t *testing.T) {
			dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
				DisableAnonymous: true,
				EnableQuota:      true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					DASHBOARD_RESOURCEGROUP: tt.unifiedStorageConfig,
					FOLDERS_RESOURCEGROUP:   tt.unifiedStorageConfig,
				},
				EnableFeatureToggles: []string{
					"kubernetesFolders",
					"kubernetesFoldersServiceV2",
					"kubernetesCliDashboards",
					"unifiedStorage",
					"unifiedStorageSearch",
					"unifiedStorageSearchUI",
					"unifiedStorageSearchSprinkles",
				},
			})

			grafanaListedAddr, env := testinfra.StartGrafanaEnv(t, dir, path)
			store, cfg := env.SQLStore, env.Cfg

			createUser(t, store, cfg, user.CreateUserCommand{
				DefaultOrgRole: string(org.RoleAdmin),
				Password:       "admin",
				Login:          "admin",
			})

			// Let's read the home.json file
			dashboardFile := loadDashboardJson(t)
			// Now let's make a request to the Grafana API to create the dashboard
			dashboardData, err := simplejson.NewJson(dashboardFile)
			require.NoError(t, err)

			uid := createDashboardLegacyAPI(t, grafanaListedAddr, dashboardData)
			dashboard := getDashboardLegacyAPI(t, grafanaListedAddr, uid)
			require.NotNil(t, dashboard)

			dashboardLegacyJSON, err := dashboardData.MarshalJSON()
			require.NoError(t, err)

			require.JSONEq(t, string(dashboardLegacyJSON), string(""))
		})
	}
}

func loadDashboardJson(t *testing.T) []byte {
	t.Helper()
	input, err := os.ReadFile(filepath.Join("./home.json"))
	require.NoError(t, err)
	return input
}

func getDashboardLegacyAPI(t *testing.T, grafanaListedAddr, uid string) *simplejson.Json {
	t.Helper()

	// Construct the URL for the dashboard API
	u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/uid/%s", grafanaListedAddr, uid)

	// Make the GET request
	resp, err := http.Get(u)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Check response status
	require.Equal(t, http.StatusOK, resp.StatusCode)

	// Read and parse the response body
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	// Parse the response JSON
	dashboard := &simplejson.Json{}
	err = dashboard.UnmarshalJSON(body)
	require.NoError(t, err)

	// Get the dashboard UID from the response
	responseUID := dashboard.Get("dashboard").Get("uid").MustString()
	require.Equal(t, uid, responseUID)

	return dashboard
}

func getDashboardAppPlatformAPI(t *testing.T, grafanaListedAddr string, dashboardData *simplejson.Json) string {
	t.Helper()
	return ""
}

func createDashboardLegacyAPI(t *testing.T, grafanaListedAddr string, dashboardData *simplejson.Json) string {
	t.Helper()
	buf1 := &bytes.Buffer{}
	err := json.NewEncoder(buf1).Encode(dashboards.SaveDashboardCommand{
		Dashboard: dashboardData,
	})
	require.NoError(t, err)
	u := fmt.Sprintf("http://admin:admin@%s/api/dashboards/db", grafanaListedAddr)
	// nolint:gosec
	resp, err := http.Post(u, "application/json", buf1)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	defer resp.Body.Close()

	var legacyResponse LegacyResponse
	err = json.Unmarshal(body, &legacyResponse)
	require.NoError(t, err)

	return legacyResponse.UID
}

type LegacyResponse struct {
	UID string `json:"uid"`
}
