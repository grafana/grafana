package api

import (
	"encoding/json"
	"testing"

	"net/http"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetFeatureToggles(t *testing.T) {
	type testCase struct {
		desc            string
		permissions     []accesscontrol.Permission
		features        []interface{}
		expectedCode    int
		hiddenTogles    map[string]struct{}
		readOnlyToggles map[string]struct{}
	}

	tests := []testCase{
		{
			desc:         "should not be able to get feature toggles without permissions",
			permissions:  []accesscontrol.Permission{},
			features:     []interface{}{},
			expectedCode: http.StatusForbidden,
		},
		{
			desc:         "should be able to get feature toggles with correct permissions",
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionFeatureManagementRead}},
			features:     []interface{}{"toggle1", true, "toggle2", false},
			expectedCode: http.StatusOK,
		},
		{
			desc:         "hidden toggles are not present in the response",
			permissions:  []accesscontrol.Permission{{Action: accesscontrol.ActionFeatureManagementRead}},
			features:     []interface{}{"toggle1", true, "toggle2", false},
			expectedCode: http.StatusOK,
			hiddenTogles: map[string]struct{}{"toggle1": {}},
		},
		{
			desc:            "read only toggles have the readOnly field set",
			permissions:     []accesscontrol.Permission{{Action: accesscontrol.ActionFeatureManagementRead}},
			features:        []interface{}{"toggle1", true, "toggle2", false},
			expectedCode:    http.StatusOK,
			hiddenTogles:    map[string]struct{}{"toggle1": {}},
			readOnlyToggles: map[string]struct{}{"toggle2": {}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.FeatureManagement.HiddenToggles = tt.hiddenTogles
			cfg.FeatureManagement.ReadOnlyToggles = tt.readOnlyToggles
			server := SetupAPITestServer(t, func(hs *HTTPServer) {
				hs.Cfg = cfg
				hs.Features = featuremgmt.WithFeatures(append([]interface{}{"featureToggleAdminPage", true}, tt.features...)...)
				hs.orgService = orgtest.NewOrgServiceFake()
				hs.userService = &usertest.FakeUserService{
					ExpectedUser: &user.User{ID: 1},
				}
			})

			req := webtest.RequestWithSignedInUser(server.NewGetRequest("/api/featuremgmt"), userWithPermissions(1, tt.permissions))
			res, err := server.SendJSON(req)
			require.NoError(t, err)
			defer func() { require.NoError(t, res.Body.Close()) }()
			assert.Equal(t, tt.expectedCode, res.StatusCode)

			if tt.expectedCode == http.StatusOK {
				var result []featuremgmt.FeatureFlag
				err := json.NewDecoder(res.Body).Decode(&result)
				require.NoError(t, err)

				for _, ft := range result {
					if _, ok := tt.hiddenTogles[ft.Name]; ok {
						t.Fail()
					}
					if _, ok := tt.readOnlyToggles[ft.Name]; ok {
						assert.True(t, ft.ReadOnly, tt.desc)
					}
				}
				assert.Equal(t, 3-len(tt.hiddenTogles), len(result), tt.desc)
			}
		})
	}
}
