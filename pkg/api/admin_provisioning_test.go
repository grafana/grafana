package api

import (
	"context"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/provisioning"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPI_AdminProvisioningReload_AccessControl(t *testing.T) {
	type testCase struct {
		desc         string
		url          string
		expectedBody string
		expectedCode int
		permissions  []accesscontrol.Permission
		checkCall    func(mock provisioning.ProvisioningServiceMock)
	}
	tests := []testCase{
		{
			desc:         "should work for dashboards with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Dashboards config reloaded"}`,
			permissions: []accesscontrol.Permission{
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
			permissions: []accesscontrol.Permission{
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
			permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  "services:noservice",
				},
			},
			url: "/api/admin/provisioning/dashboards/reload",
		},
		{
			desc:         "should fail for dashboard with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/dashboards/reload",
		},
		{
			desc:         "should work for datasources with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Datasources config reloaded"}`,
			permissions: []accesscontrol.Permission{
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
		},
		{
			desc:         "should work for plugins with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Plugins config reloaded"}`,
			permissions: []accesscontrol.Permission{
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
		},
		{
			desc:         "should fail for alerting with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/alerting/reload",
		},
		{
			desc:         "should work for alert rules with specific scope",
			expectedCode: http.StatusOK,
			expectedBody: `{"message":"Alerting config reloaded"}`,
			permissions: []accesscontrol.Permission{
				{
					Action: ActionProvisioningReload,
					Scope:  ScopeProvisionersAlertRules,
				},
			},
			url: "/api/admin/provisioning/alerting/reload",
			checkCall: func(mock provisioning.ProvisioningServiceMock) {
				assert.Len(t, mock.Calls.ProvisionAlerting, 1)
			},
		},
		{
			desc:         "should fail for alerting with no permission",
			expectedCode: http.StatusForbidden,
			url:          "/api/admin/provisioning/alerting/reload",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			pService := provisioning.NewProvisioningServiceMock(context.Background())
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = setting.ProvideService(setting.NewCfg())
				hs.ProvisioningService = pService
			})

			res, err := server.Send(webtest.RequestWithSignedInUser(server.NewPostRequest(tt.url, nil), userWithPermissions(1, tt.permissions)))
			require.NoError(t, err)
			assert.Equal(t, tt.expectedCode, res.StatusCode)

			if tt.expectedCode == http.StatusOK {
				body, err := io.ReadAll(res.Body)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedBody, string(body))
			}

			require.NoError(t, res.Body.Close())

			if tt.checkCall != nil {
				// Check we actually called the provisioning service
				tt.checkCall(*pService)
			}
		})
	}
}
