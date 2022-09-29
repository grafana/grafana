package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func fakeGNETBackend(t *testing.T) *httptest.Server {
	return httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			file, err := os.Open("./pluginproxy/test-data/gnet-list.json")
			require.NoError(t, err)
			defer func() { _ = file.Close() }()

			pluginList, err := io.ReadAll(file)
			require.NoError(t, err)

			// Check encoding has been removed
			require.Empty(t, r.Header.Get("Accept-Encoding"))

			_, err = w.Write(pluginList)
			require.NoError(t, err)
			w.Header().Set("Content-Type", "application/json")
		}),
	)
}

func setHeaders(headers map[string]string) func(*http.Request) {
	return func(r *http.Request) {
		for h, v := range headers {
			r.Header.Set(h, v)
		}
	}
}

func TestHTTPServer_ListGnetPlugins(t *testing.T) {
	sc := setupHTTPServer(t, true)
	setInitCtxSignedInViewer(sc.initCtx)
	sc.cfg.BuildVersion = "9.2.0"
	sc.hs.log = log.New("httpserver-test")

	tests := []struct {
		name        string
		headers     map[string]string
		permissions []ac.Permission
		want        map[string]ac.Metadata
	}{
		{
			name:        "BASIC",
			headers:     map[string]string{"Accept-Encoding": ""},
			permissions: []ac.Permission{{Action: "plugins:read", Scope: "plugins:id:*"}},
			want: map[string]ac.Metadata{
				"grafana-enterprise-logs-app":    {"plugins:read": true},
				"grafana-metrics-enterprise-app": {"plugins:read": true},
				"grafana-enterprise-traces-app":  {"plugins:read": true},
			},
		},
		{
			name:        "WITH_GZIP_COMPRESSION",
			headers:     map[string]string{"Accept-Encoding": "gzip"},
			permissions: []ac.Permission{{Action: "plugins:read", Scope: "plugins:id:*"}},
			want: map[string]ac.Metadata{
				"grafana-enterprise-logs-app":    {"plugins:read": true},
				"grafana-metrics-enterprise-app": {"plugins:read": true},
				"grafana-enterprise-traces-app":  {"plugins:read": true},
			},
		},
		{
			name:    "WITH_ID_SPECIFIC_PERMISSIONS",
			headers: map[string]string{"Accept-Encoding": ""},
			permissions: []ac.Permission{
				{Action: "plugins:read", Scope: "plugins:id:grafana-enterprise-logs-app"},
				{Action: "plugins:write", Scope: "plugins:id:grafana-enterprise-logs-app"},
				{Action: "plugins:read", Scope: "plugins:id:grafana-metrics-enterprise-app"},
			},
			want: map[string]ac.Metadata{
				"grafana-enterprise-logs-app":    {"plugins:read": true, "plugins:write": true},
				"grafana-metrics-enterprise-app": {"plugins:read": true},
				"grafana-enterprise-traces-app":  nil,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			backend := fakeGNETBackend(t)
			defer backend.Close()
			sc.cfg.GrafanaComURL = backend.URL
			setting.GrafanaComUrl = backend.URL

			setAccessControlPermissions(sc.acmock, tt.permissions, sc.initCtx.OrgID)
			response := callAPIWithOpts(t, sc.server, http.MethodGet, "/api/gnet/plugins/", nil, setHeaders(tt.headers))
			require.Equal(t, http.StatusOK, response.Code)

			pluginList := map[string]interface{}{}
			errUnmarshal := json.Unmarshal(response.Body.Bytes(), &pluginList)
			require.NoError(t, errUnmarshal)

			items, ok := pluginList["items"].([]interface{})
			require.True(t, ok)

			metadataByPlugin := map[string]ac.Metadata{}
			for i := range items {
				item, ok := items[i].(map[string]interface{})
				require.True(t, ok)

				slug, ok := item["slug"]
				require.True(t, ok)

				accessControl, ok := item["accessControl"]
				require.True(t, ok)

				var metadata ac.Metadata
				if accessControl != nil {
					metadata = ac.Metadata{}
					accessControlMap, ok := accessControl.(map[string]interface{})
					require.True(t, ok)
					for action := range accessControlMap {
						metadata[action] = true
					}
				}

				pluginID := slug.(string)
				metadataByPlugin[pluginID] = metadata
			}

			require.Equal(t, tt.want, metadataByPlugin)
		})
	}
}
