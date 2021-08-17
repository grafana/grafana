package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

type getSettingsTestCase struct {
	desc         string
	expectedCode int
	expectedBody string
	permissions  []*accesscontrol.Permission
}

func TestAPI_AdminGetSettings(t *testing.T) {
	tests := []getSettingsTestCase{
		{
			desc:         "should return all settings",
			expectedCode: http.StatusOK,
			expectedBody: `{"auth.proxy":{"enable_login_token":"false","enabled":"false"},"auth.saml":{"allow_idp_initiated":"false","enabled":"true"}}`,
			permissions: []*accesscontrol.Permission{
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
			permissions: []*accesscontrol.Permission{
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
			permissions: []*accesscontrol.Permission{
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

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			sc, hs := setupAccessControlScenarioContext(t, cfg, "/api/admin/settings", test.permissions)
			hs.SettingsProvider = &setting.OSSImpl{Cfg: cfg}

			sc.resp = httptest.NewRecorder()
			var err error
			sc.req, err = http.NewRequest(http.MethodGet, "/api/admin/settings", nil)
			assert.NoError(t, err)

			sc.exec()

			assert.Equal(t, test.expectedCode, sc.resp.Code)
			assert.Equal(t, test.expectedBody, sc.resp.Body.String())
		})
	}
}

func TestAdmin_AccessControl(t *testing.T) {
	tests := []accessControlTestCase{
		{
			expectedCode: http.StatusOK,
			desc:         "AdminGetStats should return 200 for user with correct permissions",
			url:          "/api/admin/stats",
			method:       http.MethodGet,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionServerStatsRead,
				},
			},
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "AdminGetStats should return 403 for user without required permissions",
			url:          "/api/admin/stats",
			method:       http.MethodGet,
			permissions: []*accesscontrol.Permission{
				{
					Action: "wrong",
				},
			},
		},
		{
			expectedCode: http.StatusOK,
			desc:         "AdminGetSettings should return 200 for user with correct permissions",
			url:          "/api/admin/settings",
			method:       http.MethodGet,
			permissions: []*accesscontrol.Permission{
				{
					Action: accesscontrol.ActionSettingsRead,
				},
			},
		},
		{
			expectedCode: http.StatusForbidden,
			desc:         "AdminGetSettings should return 403 for user without required permissions",
			url:          "/api/admin/settings",
			method:       http.MethodGet,
			permissions: []*accesscontrol.Permission{
				{
					Action: "wrong",
				},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			sc, hs := setupAccessControlScenarioContext(t, cfg, test.url, test.permissions)
			sc.resp = httptest.NewRecorder()
			hs.SettingsProvider = &setting.OSSImpl{Cfg: cfg}

			var err error
			sc.req, err = http.NewRequest(test.method, test.url, nil)
			assert.NoError(t, err)

			sc.exec()
			assert.Equal(t, test.expectedCode, sc.resp.Code)
		})
	}
}
