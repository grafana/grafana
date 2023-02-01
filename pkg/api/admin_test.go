package api

import (
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db/dbtest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/stats/statstest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPI_AdminGetSettings(t *testing.T) {
	type testCase struct {
		desc         string
		expectedCode int
		expectedBody string
		permissions  []accesscontrol.Permission
	}
	tests := []testCase{
		{
			desc:         "should return all settings",
			expectedCode: http.StatusOK,
			expectedBody: `{"auth.proxy":{"enable_login_token":"false","enabled":"false"},"auth.saml":{"allow_idp_initiated":"false","enabled":"true"}}`,
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsRead,
					Scope:  accesscontrol.ScopeSettingsAll,
				},
			},
		},
		{
			desc:         "should only return auth.saml settings",
			expectedCode: http.StatusOK,
			expectedBody: `{"auth.saml":{"allow_idp_initiated":"false","enabled":"true"}}`,
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsRead,
					Scope:  "settings:auth.saml:*",
				},
			},
		},
		{
			desc:         "should only partial properties from auth.saml and auth.proxy settings",
			expectedCode: http.StatusOK,
			expectedBody: `{"auth.proxy":{"enable_login_token":"false"},"auth.saml":{"enabled":"true"}}`,
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsRead,
					Scope:  "settings:auth.saml:enabled",
				},
				{
					Action: accesscontrol.ActionSettingsRead,
					Scope:  "settings:auth.proxy:enable_login_token",
				},
			},
		},
	}

	cfg := setting.NewCfg()
	//seed sections and keys
	cfg.Raw.DeleteSection("DEFAULT")
	saml, err := cfg.Raw.NewSection("auth.saml")
	assert.NoError(t, err)
	_, err = saml.NewKey("enabled", "true")
	assert.NoError(t, err)
	_, err = saml.NewKey("allow_idp_initiated", "false")
	assert.NoError(t, err)

	proxy, err := cfg.Raw.NewSection("auth.proxy")
	assert.NoError(t, err)
	_, err = proxy.NewKey("enabled", "false")
	assert.NoError(t, err)
	_, err = proxy.NewKey("enable_login_token", "false")
	assert.NoError(t, err)

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = cfg
				hs.SettingsProvider = setting.ProvideProvider(hs.Cfg)
			})

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest("/api/admin/settings"), userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			body, err := io.ReadAll(res.Body)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedBody, string(body))
			require.NoError(t, res.Body.Close())
		})
	}
}

func TestAdmin_AccessControl(t *testing.T) {
	type testCase struct {
		desc         string
		url          string
		permissions  []accesscontrol.Permission
		expectedCode int
	}

	tests := []testCase{
		{
			expectedCode: http.StatusOK,
			desc:         "AdminGetStats should return 200 for user with correct permissions",
			url:          "/api/admin/stats",
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionServerStatsRead,
				},
			},
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "AdminGetStats should return 403 for user without required permissions",
			url:          "/api/admin/stats",
			permissions: []accesscontrol.Permission{
				{
					Action: "wrong",
				},
			},
		},
		{
			expectedCode: http.StatusOK,
			desc:         "AdminGetSettings should return 200 for user with correct permissions",
			url:          "/api/admin/settings",
			permissions: []accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsRead,
				},
			},
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "AdminGetSettings should return 403 for user without required permissions",
			url:          "/api/admin/settings",
			permissions: []accesscontrol.Permission{
				{
					Action: "wrong",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.NewCfg()
				hs.SQLStore = dbtest.NewFakeDB()
				hs.SettingsProvider = &setting.OSSImpl{Cfg: hs.Cfg}
				hs.statsService = statstest.NewFakeService()
			})

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewGetRequest(tt.url), userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)
			require.NoError(t, res.Body.Close())
		})
	}
}
