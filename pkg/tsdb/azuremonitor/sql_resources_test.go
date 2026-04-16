package azuremonitor

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func TestDiscoverResourcesForAzureMonitorSQL_ReturnsResources(t *testing.T) {
	body := `{
	  "data": {
	    "columns": [
	      {"name": "name", "type": "string"},
	      {"name": "resourceGroup", "type": "string"}
	    ],
	    "rows": [
	      ["vm-a", "rg1"],
	      ["vm-b", "rg1"]
	    ]
	  }
	}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.Contains(t, string(b), "Resources | where type =~ 'microsoft.compute/virtualmachines'")
		require.Contains(t, string(b), "resourceGroup =~ 'rg1'")
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	dsInfo := types.DatasourceInfo{
		Routes: map[string]types.AzRoute{
			azureResourceGraph: {URL: srv.URL},
		},
		Services: map[string]types.DatasourceService{
			azureResourceGraph: {HTTPClient: srv.Client(), URL: srv.URL},
		},
	}

	out, err := discoverResourcesForAzureMonitorSQL(context.Background(), dsInfo,
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rg1", "microsoft.compute/virtualmachines")
	require.NoError(t, err)
	require.Len(t, out, 2)
	require.Equal(t, "vm-a", *out[0].ResourceName)
	require.Equal(t, "vm-b", *out[1].ResourceName)
	require.Equal(t, "rg1", *out[0].ResourceGroup)
	require.Equal(t, "microsoft.compute/virtualmachines", *out[0].MetricNamespace)
}

func TestDiscoverResourcesForAzureMonitorSQL_TooManyResources(t *testing.T) {
	n := azureMonitorSQLMaxResourcesPerQuery + 1
	rows := make([]any, n)
	for i := 0; i < n; i++ {
		rows[i] = []any{fmt.Sprintf("vm%d", i), "rg1"}
	}
	payload := map[string]any{
		"data": map[string]any{
			"columns": []map[string]string{
				{"name": "name", "type": "string"},
				{"name": "resourceGroup", "type": "string"},
			},
			"rows": rows,
		},
	}
	raw, err := json.Marshal(payload)
	require.NoError(t, err)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write(raw)
	}))
	defer srv.Close()

	dsInfo := types.DatasourceInfo{
		Routes: map[string]types.AzRoute{
			azureResourceGraph: {URL: srv.URL},
		},
		Services: map[string]types.DatasourceService{
			azureResourceGraph: {HTTPClient: srv.Client(), URL: srv.URL},
		},
	}

	_, err = discoverResourcesForAzureMonitorSQL(context.Background(), dsInfo,
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rg1", "microsoft.compute/virtualmachines")
	require.Error(t, err)
	require.Contains(t, err.Error(), "too many resources")
}

func TestDiscoverResourcesForAzureMonitorSQL_Empty(t *testing.T) {
	body := `{"data":{"columns":[{"name":"name","type":"string"},{"name":"resourceGroup","type":"string"}],"rows":[]}}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()

	dsInfo := types.DatasourceInfo{
		Routes: map[string]types.AzRoute{
			azureResourceGraph: {URL: srv.URL},
		},
		Services: map[string]types.DatasourceService{
			azureResourceGraph: {HTTPClient: srv.Client(), URL: srv.URL},
		},
	}

	_, err := discoverResourcesForAzureMonitorSQL(context.Background(), dsInfo,
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rg1", "microsoft.compute/virtualmachines")
	require.Error(t, err)
	require.Contains(t, err.Error(), "no resources found")
}
