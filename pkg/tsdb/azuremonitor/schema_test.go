package azuremonitor

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
)

func argTestServer(t *testing.T, responseBody string, assertKQL func(string)) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if assertKQL != nil {
			b, err := io.ReadAll(r.Body)
			require.NoError(t, err)
			assertKQL(string(b))
		}
		_, _ = w.Write([]byte(responseBody))
	}))
}

func argDSInfo(srv *httptest.Server) types.DatasourceInfo {
	return types.DatasourceInfo{
		Routes: map[string]types.AzRoute{
			azureResourceGraph: {URL: srv.URL},
		},
		Services: map[string]types.DatasourceService{
			azureResourceGraph: {HTTPClient: srv.Client(), URL: srv.URL},
		},
	}
}

func TestListResourceGroupsForNamespace(t *testing.T) {
	t.Run("returns distinct resource groups", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"resourceGroup","type":"string"}],"rows":[["rg-alpha"],["rg-beta"]]}}`
		srv := argTestServer(t, body, func(kql string) {
			require.Contains(t, kql, "microsoft.compute/virtualmachines")
			require.Contains(t, kql, "distinct resourceGroup")
		})
		defer srv.Close()

		out, err := listResourceGroupsForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines")
		require.NoError(t, err)
		require.Equal(t, []string{"rg-alpha", "rg-beta"}, out)
	})

	t.Run("returns nil on empty results", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"resourceGroup","type":"string"}],"rows":[]}}`
		srv := argTestServer(t, body, nil)
		defer srv.Close()

		out, err := listResourceGroupsForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines")
		require.NoError(t, err)
		require.Nil(t, out)
	})
}

func TestListRegionsForNamespace(t *testing.T) {
	t.Run("returns distinct regions without resourceGroup filter", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"location","type":"string"}],"rows":[["eastus"],["westeurope"]]}}`
		srv := argTestServer(t, body, func(kql string) {
			require.Contains(t, kql, "distinct location")
			require.NotContains(t, kql, "resourceGroup")
		})
		defer srv.Close()

		out, err := listRegionsForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "")
		require.NoError(t, err)
		require.Equal(t, []string{"eastus", "westeurope"}, out)
	})

	t.Run("narrows by resourceGroup when provided", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"location","type":"string"}],"rows":[["westeurope"]]}}`
		srv := argTestServer(t, body, func(kql string) {
			require.Contains(t, kql, "resourceGroup =~ 'rg1'")
		})
		defer srv.Close()

		out, err := listRegionsForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "rg1")
		require.NoError(t, err)
		require.Equal(t, []string{"westeurope"}, out)
	})
}

func TestListResourceNamesForNamespace(t *testing.T) {
	t.Run("returns resource names", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"name","type":"string"}],"rows":[["vm-a"],["vm-b"],["vm-c"]]}}`
		srv := argTestServer(t, body, func(kql string) {
			require.Contains(t, kql, "resourceGroup =~ 'rg1'")
			require.Contains(t, kql, "project name")
		})
		defer srv.Close()

		out, err := listResourceNamesForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "rg1", "")
		require.NoError(t, err)
		require.Equal(t, []string{"vm-a", "vm-b", "vm-c"}, out)
	})

	t.Run("narrows by region when provided", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"name","type":"string"}],"rows":[["vm-a"]]}}`
		srv := argTestServer(t, body, func(kql string) {
			require.Contains(t, kql, "location =~ 'westeurope'")
		})
		defer srv.Close()

		out, err := listResourceNamesForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "rg1", "westeurope")
		require.NoError(t, err)
		require.Equal(t, []string{"vm-a"}, out)
	})

	t.Run("returns nil when resourceGroup is empty", func(t *testing.T) {
		out, err := listResourceNamesForNamespace(context.Background(), types.DatasourceInfo{},
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "", "")
		require.NoError(t, err)
		require.Nil(t, out)
	})

	t.Run("returns nil on empty results", func(t *testing.T) {
		body := `{"data":{"columns":[{"name":"name","type":"string"}],"rows":[]}}`
		srv := argTestServer(t, body, nil)
		defer srv.Close()

		out, err := listResourceNamesForNamespace(context.Background(), argDSInfo(srv),
			"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "microsoft.compute/virtualmachines", "rg1", "")
		require.NoError(t, err)
		require.Nil(t, out)
	})
}
