package azuremonitor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

func TestIntegrationAzureMonitor(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		DisableAnonymous: true,
	})

	grafanaListeningAddr, testEnv := testinfra.StartGrafanaEnv(t, dir, path)
	ctx := context.Background()

	u := testinfra.CreateUser(t, testEnv.SQLStore, user.CreateUserCommand{
		DefaultOrgRole: string(org.RoleAdmin),
		Password:       "admin",
		Login:          "admin",
	})

	var outgoingRequest *http.Request
	outgoingServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		outgoingRequest = r
		w.WriteHeader(http.StatusUnauthorized)
	}))
	t.Cleanup(outgoingServer.Close)

	jsonData := simplejson.NewFromAny(map[string]interface{}{
		"httpHeaderName1": "X-CUSTOM-HEADER",
		"clientId":        "test-client-id",
		"tenantId":        "test-tenant-id",
		"cloudName":       "customizedazuremonitor",
		"customizedRoutes": map[string]interface{}{
			"Azure Monitor": map[string]interface{}{
				"URL": outgoingServer.URL,
				"Headers": map[string]string{
					"custom-azure-header": "custom-azure-value",
				},
			},
		},
	})
	secureJSONData := map[string]string{
		"clientSecret":     "test-client-secret",
		"httpHeaderValue1": "custom-header-value",
	}

	uid := "azuremonitor"
	_, err := testEnv.Server.HTTPServer.DataSourcesService.AddDataSource(ctx, &datasources.AddDataSourceCommand{
		OrgID:          u.OrgID,
		Access:         datasources.DS_ACCESS_PROXY,
		Name:           "Azure Monitor",
		Type:           datasources.DS_AZURE_MONITOR,
		UID:            uid,
		URL:            outgoingServer.URL,
		JsonData:       jsonData,
		SecureJsonData: secureJSONData,
	})
	require.NoError(t, err)

	t.Run("When calling /api/ds/query should set expected headers on outgoing HTTP request", func(t *testing.T) {
		query := simplejson.NewFromAny(map[string]interface{}{
			"datasource": map[string]interface{}{
				"type": "grafana-azure-monitor-datasource",
				"uid":  uid,
			},
			"queryType": "Azure Monitor",
			"azureMonitor": map[string]interface{}{
				"resourceGroup":   "test-rg",
				"metricNamespace": "microsoft.storage/storageaccounts",
				"resourceName":    "testacct",
				"timeGrain":       "auto",
				"metricName":      "UsedCapacity",
				"aggregation":     "Average",
			},
			"subscription": "test-sub",
			"intervalMs":   30000,
		})
		buf1 := &bytes.Buffer{}
		err = json.NewEncoder(buf1).Encode(dtos.MetricRequest{
			From:    "1668078080000",
			To:      "1668081680000",
			Queries: []*simplejson.Json{query},
		})
		require.NoError(t, err)
		u := fmt.Sprintf("http://admin:admin@%s/api/ds/query", grafanaListeningAddr)
		// nolint:gosec
		resp, err := http.Post(u, "application/json", buf1)
		require.NoError(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		_, err = io.ReadAll(resp.Body)
		require.NoError(t, err)

		require.NotNil(t, outgoingRequest)
		require.Equal(t, "/subscriptions/test-sub/resourceGroups/test-rg/providers/microsoft.storage/storageaccounts/testacct/providers/microsoft.insights/metrics?aggregation=Average&api-version=2021-05-01&interval=PT1M&metricnames=UsedCapacity&metricnamespace=microsoft.storage%2Fstorageaccounts&timespan=2022-11-10T11%3A01%3A20Z%2F2022-11-10T12%3A01%3A20Z",
			outgoingRequest.URL.String())
		require.Equal(t, "custom-header-value", outgoingRequest.Header.Get("X-CUSTOM-HEADER"))
		require.Equal(t, "custom-azure-value", outgoingRequest.Header.Get("custom-azure-header"))
	})
}
