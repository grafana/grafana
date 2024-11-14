package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPServer_CheckEnabled(t *testing.T) {
	tests := []struct {
		name         string
		pluginID     string
		expectedCode int
	}{
		{
			name:         "should return a 404 if the plugin doesn't exist",
			pluginID:     "missing",
			expectedCode: 404,
		},
		{
			name:         "should not set an error code if the plugin is not an app",
			pluginID:     "mysql",
			expectedCode: 0, // unset
		},
		{
			name:         "should not set an error code if the plugin is enabled",
			pluginID:     "grafana-test-app",
			expectedCode: 0, // unset
		},
		{
			name:         "should return a 404 if the plugin is disabled",
			pluginID:     "grafana-test-app_disabled",
			expectedCode: 404,
		},
		{
			name:         "should not set an error code if the plugin is auto enabled, without a saved plugin setting",
			pluginID:     "grafana-test-app_autoEnabled",
			expectedCode: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hs := &HTTPServer{}
			hs.pluginStore = &pluginstore.FakePluginStore{
				PluginList: []pluginstore.Plugin{
					{JSONData: plugins.JSONData{ID: "mysql"}},
					{JSONData: plugins.JSONData{Type: plugins.TypeApp, ID: "grafana-test-app"}},
					{JSONData: plugins.JSONData{Type: plugins.TypeApp, ID: "grafana-test-app_disabled"}},
					{JSONData: plugins.JSONData{Type: plugins.TypeApp, ID: "grafana-test-app_autoEnabled", AutoEnabled: true}},
				},
			}
			hs.PluginSettings = &pluginsettings.FakePluginSettings{Plugins: map[string]*pluginsettings.DTO{
				"grafana-test-app":          {ID: 0, OrgID: 1, PluginID: "grafana-test-app", PluginVersion: "1.0.0", Enabled: true},
				"grafana-test-app_disabled": {ID: 0, OrgID: 1, PluginID: "grafana-test-app_disabled", PluginVersion: "1.0.0", Enabled: false},
			}}
			httpReq, err := http.NewRequest(http.MethodGet, "", nil)
			httpReq = web.SetURLParams(httpReq, map[string]string{":pluginId": tt.pluginID})
			require.NoError(t, err)

			responseWriter := web.NewResponseWriter("GET", httptest.NewRecorder())
			c := &contextmodel.ReqContext{
				Context:      &web.Context{Req: httpReq, Resp: responseWriter},
				SignedInUser: &user.SignedInUser{OrgID: 1},
			}
			checkAppEnabled(hs.pluginStore, hs.PluginSettings)(c)
			assert.Equal(t, tt.expectedCode, c.Resp.Status())
		})
	}
}
