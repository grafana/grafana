package managertest

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestPluginManager_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	provisioningFile := filepath.Join(t.TempDir(), "apps.yaml")
	err := os.WriteFile(provisioningFile, []byte(`apiVersion: 1

apps:
  - type: test-app
    org_id: 1
    org_name: Main Org.
    disabled: false
    jsonData:
      apiKey: "test-api-key"
    secureJsonData:
      secretKey: "test-secret-key"`), 0644)
	require.NoError(t, err)

	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		EnableLog:         true,
		AnonymousUserRole: org.RoleAdmin,
	})

	err = fs.CopyRecursive(provisioningFile, filepath.Join(dir, "conf", "provisioning", "plugins", "apps.yaml"))
	require.NoError(t, err)

	// Load plugin from testdata directory
	pluginPath := filepath.Join("testdata", "test-app")
	err = fs.CopyRecursive(pluginPath, filepath.Join(dir, "plugins", "test-app"))
	require.NoError(t, err)

	grafanaListedAddr, _ := testinfra.StartGrafanaEnv(t, dir, path)

	t.Run("Load plugin and test HTTP API", func(t *testing.T) {
		// Test plugin's dashboard endpoint
		resp, err := http.Get(fmt.Sprintf("http://%s/public/plugins/test-app/dashboards/dashboard.json", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Get(fmt.Sprintf("http://%s/api/plugins/test-app/settings", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		require.Equal(t, http.StatusOK, resp.StatusCode)

		endpoint := fmt.Sprintf("http://%s/api/plugins/test-app/dashboards", grafanaListedAddr)
		resp, err = http.Get(endpoint)
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})

		// Test Grafana's dashboard API endpoint
		resp, err = http.Get(fmt.Sprintf("http://%s/api/dashboards/uid/1MHHlVjzz", grafanaListedAddr))
		require.NoError(t, err)
		require.NotNil(t, resp)
		t.Cleanup(func() {
			err := resp.Body.Close()
			require.NoError(t, err)
		})
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)
		require.NotEmpty(t, body)
		fmt.Println(string(body))

		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}
