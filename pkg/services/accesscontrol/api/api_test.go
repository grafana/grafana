package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/api/routing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web/webtest"
	"github.com/stretchr/testify/require"
)

func TestAPI_getUserPermissions(t *testing.T) {
	type testCase struct {
		desc           string
		permissions    []ac.Permission
		scoped         bool
		expectedOutput util.DynMap
		expectedCode   int
	}

	tests := []testCase{
		{
			desc: "Should be able to get permissions with scope",
			permissions: []ac.Permission{
				{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
				{Action: datasources.ActionRead, Scope: datasources.ScopeProvider.GetResourceScope("aabbccdd")},
			},
			scoped: true,
			expectedOutput: util.DynMap{
				datasources.ActionRead: []interface{}{
					datasources.ScopeAll,
					datasources.ScopeProvider.GetResourceScope("aabbccdd"),
				}},
			expectedCode: http.StatusOK,
		},
		{
			desc: "Should be able to get actions",
			permissions: []ac.Permission{
				{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
				{Action: datasources.ActionRead, Scope: datasources.ScopeProvider.GetResourceScope("aabbccdd")},
			},
			scoped:         false,
			expectedOutput: util.DynMap{datasources.ActionRead: true},
			expectedCode:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			acSvc := actest.FakeService{ExpectedPermissions: tt.permissions}
			api := NewAccessControlAPI(routing.NewRouteRegister(), acSvc)
			api.RegisterAPIEndpoints()

			server := webtest.NewServer(t, api.RouteRegister)
			url := "/api/access-control/user/permissions"
			if tt.scoped {
				url += "?scoped=true"
			}

			req := server.NewGetRequest(url)
			webtest.RequestWithSignedInUser(req, &user.SignedInUser{
				OrgID:       1,
				Permissions: map[int64]map[string][]string{},
			})
			res, err := server.Send(req)
			defer func() { require.NoError(t, res.Body.Close()) }()
			require.NoError(t, err)
			require.Equal(t, tt.expectedCode, res.StatusCode)

			if tt.expectedCode == http.StatusOK {
				var output util.DynMap
				err := json.NewDecoder(res.Body).Decode(&output)
				require.NoError(t, err)
				require.Equal(t, tt.expectedOutput, output)
			}
		})
	}
}
