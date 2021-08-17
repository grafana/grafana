package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

type reloadProvisioningTestCase struct {
	desc         string
	url          string
	expectedCode int
	expectedBody string
	permissions  []*accesscontrol.Permission
	exit         bool
	checkCall    func(mock provisioning.ProvisioningServiceMock)
}

func TestAPI_AdminProvisioningReload_AccessControl(t *testing.T) {
	tests := []reloadProvisioningTestCase{
		{
			desc:         "should work for dashboards with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Dashboards config reloaded"}`,
			permissions: []*accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersDashboards,
				},
			},
			url: "/api/admin/provisioning/dashboards/reload",
			checkCall: func(mock provisioning.ProvisioningServiceMock) {
				assert.Len(t, mock.Calls.ProvisionDashboards, 1)
			},
		},
		{
			desc:         "should work for dashboards with broader scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Dashboards config reloaded"}`,
			permissions: []*accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersAll,
				},
			},
			url: "/api/admin/provisioning/dashboards/reload",
			checkCall: func(mock provisioning.ProvisioningServiceMock) {
				assert.Len(t, mock.Calls.ProvisionDashboards, 1)
			},
		},
		{
			desc:         "should fail for dashboard with wrong scope",
			expectedCode: http.StatusForbidden,
			permissions: []*accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  "services:noservice",
				},
			},
			url:  "/api/admin/provisioning/dashboards/reload",
			exit: true,
		},
		{
			desc:         "should fail for dashboard with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/dashboards/reload",
			exit:         true,
		},
		{
			desc:         "should work for notifications with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Notifications config reloaded"}`,
			permissions: []*accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersNotifications,
				},
			},
			url: "/api/admin/provisioning/notifications/reload",
			checkCall: func(mock provisioning.ProvisioningServiceMock) {
				assert.Len(t, mock.Calls.ProvisionNotifications, 1)
			},
		},
		{
			desc:         "should fail for notifications with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/notifications/reload",
			exit:         true,
		},
		{
			desc:         "should work for datasources with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Datasources config reloaded"}`,
			permissions: []*accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersDatasources,
				},
			},
			url: "/api/admin/provisioning/datasources/reload",
			checkCall: func(mock provisioning.ProvisioningServiceMock) {
				assert.Len(t, mock.Calls.ProvisionDatasources, 1)
			},
		},
		{
			desc:         "should fail for datasources with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/datasources/reload",
			exit:         true,
		},
		{
			desc:         "should work for plugins with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Plugins config reloaded"}`,
			permissions: []*accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersPlugins,
				},
			},
			url: "/api/admin/provisioning/plugins/reload",
			checkCall: func(mock provisioning.ProvisioningServiceMock) {
				assert.Len(t, mock.Calls.ProvisionPlugins, 1)
			},
		},
		{
			desc:         "should fail for plugins with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/plugins/reload",
			exit:         true,
		},
	}

	cfg := setting.NewCfg()

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			sc, hs := setupAccessControlScenarioContext(t, cfg, test.url, test.permissions)

			// Setup the mock
			provisioningMock := provisioning.NewProvisioningServiceMock()
			hs.ProvisioningService = provisioningMock

			sc.resp = httptest.NewRecorder()
			var err error
			sc.req, err = http.NewRequest(http.MethodPost, test.url, nil)
			assert.NoError(t, err)

			sc.exec()

			// Check return code
			assert.Equal(t, test.expectedCode, sc.resp.Code)
			if test.exit {
				return
			}

			// Check body
			assert.Equal(t, test.expectedBody, sc.resp.Body.String())

			// Check we actually called the provisioning service
			test.checkCall(*provisioningMock)
		})
	}
}
