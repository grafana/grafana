package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

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
