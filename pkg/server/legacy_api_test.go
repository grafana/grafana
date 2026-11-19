package server

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

func TestLegacyAPIService(t *testing.T) {
	instrumentation := mux.NewRouter()
	health := NewHealthNotifier()
	RegisterHealthEndpoints(instrumentation, health)

	svc := newLegacyAPIService("127.0.0.1:0", health, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))

	probe := func(path string) int {
		rec := httptest.NewRecorder()
		instrumentation.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil))
		return rec.Code
	}
	get := func(path string) int {
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://"+svc.Addr().String()+path, nil)
		require.NoError(t, err)
		rsp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		require.NoError(t, rsp.Body.Close())
		return rsp.StatusCode
	}

	assert.Equal(t, http.StatusServiceUnavailable, probe("/readyz"))

	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	assert.Equal(t, http.StatusOK, probe("/readyz"))
	assert.Equal(t, http.StatusTeapot, get("/api/dashboards/uid/abc"))
	assert.Equal(t, http.StatusNotFound, probe("/api/dashboards/uid/abc"), "the instrumentation server must not serve legacy routes")

	require.NoError(t, services.StopAndAwaitTerminated(t.Context(), svc))
	assert.Equal(t, http.StatusServiceUnavailable, probe("/readyz"))
}

func TestLegacyAPIConfig(t *testing.T) {
	newCfg := func(t *testing.T, raw string) *setting.Cfg {
		t.Helper()
		cfg := setting.NewCfg()
		var err error
		cfg.Raw, err = ini.Load([]byte(raw))
		require.NoError(t, err)
		return cfg
	}

	t.Run("reads the API server URLs and the service token", func(t *testing.T) {
		cfg := newCfg(t, `
[legacy_api]
dashboard_api_url = https://dashboards
folder_api_url = https://folders
iam_api_url = https://iam

[grpc_client_authentication]
token = service-token
`)
		addr, out, err := legacyAPIConfig(cfg)
		require.NoError(t, err)
		assert.Equal(t, ":3001", addr)
		assert.Equal(t, "https://dashboards", out.DashboardAPIURL)
		assert.Equal(t, "https://folders", out.FolderAPIURL)
		assert.Equal(t, "https://iam", out.IAMAPIURL)
		assert.NotNil(t, out.TokenExchanger)
		assert.NotNil(t, out.HTTPClient)
	})

	t.Run("listen address and no service token", func(t *testing.T) {
		cfg := newCfg(t, `
[legacy_api]
http_addr = 127.0.0.1
http_port = 4000
dashboard_api_url = https://dashboards
folder_api_url = https://folders
iam_api_url = https://iam
`)
		addr, out, err := legacyAPIConfig(cfg)
		require.NoError(t, err)
		assert.Equal(t, "127.0.0.1:4000", addr)
		assert.Nil(t, out.TokenExchanger)
	})

	t.Run("API server URLs are required", func(t *testing.T) {
		_, _, err := legacyAPIConfig(newCfg(t, "[legacy_api]\ndashboard_api_url = https://dashboards\n"))
		require.ErrorContains(t, err, "folder_api_url")
	})

	t.Run("CA file", func(t *testing.T) {
		caPath := filepath.Join(t.TempDir(), "ca.crt")
		require.NoError(t, os.WriteFile(caPath, []byte("not a certificate"), 0o600))
		_, _, err := legacyAPIConfig(newCfg(t, `
[legacy_api]
dashboard_api_url = https://dashboards
folder_api_url = https://folders
iam_api_url = https://iam
tls_ca_path = `+caPath+`
`))
		require.ErrorContains(t, err, "tls_ca_path")
	})
}
