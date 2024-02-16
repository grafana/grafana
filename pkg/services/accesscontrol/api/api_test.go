package api

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestAPI_getUserActions(t *testing.T) {
	type testCase struct {
		desc           string
		permissions    []ac.Permission
		expectedOutput util.DynMap
		expectedCode   int
	}

	tests := []testCase{
		{
			desc: "Should be able to get actions",
			permissions: []ac.Permission{
				{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
				{Action: datasources.ActionRead, Scope: datasources.ScopeProvider.GetResourceScope("aabbccdd")},
			},
			expectedOutput: util.DynMap{datasources.ActionRead: true},
			expectedCode:   http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			acSvc := actest.FakeService{ExpectedPermissions: tt.permissions}
			api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, featuremgmt.WithFeatures())
			api.RegisterAPIEndpoints()

			server := webtest.NewServer(t, api.RouteRegister)
			url := "/api/access-control/user/actions"

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

func TestAPI_getUserPermissions(t *testing.T) {
	type testCase struct {
		desc           string
		permissions    []ac.Permission
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
			expectedOutput: util.DynMap{
				datasources.ActionRead: []any{
					datasources.ScopeAll,
					datasources.ScopeProvider.GetResourceScope("aabbccdd"),
				}},
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			acSvc := actest.FakeService{ExpectedPermissions: tt.permissions}
			api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, featuremgmt.WithFeatures())
			api.RegisterAPIEndpoints()

			server := webtest.NewServer(t, api.RouteRegister)
			url := "/api/access-control/user/permissions"

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

func TestAccessControlAPI_searchUsersPermissions(t *testing.T) {
	type testCase struct {
		desc           string
		permissions    map[int64][]ac.Permission
		filters        string
		expectedOutput map[int64]map[string][]string
		expectedCode   int
	}

	tests := []testCase{
		{
			desc:         "Should reject if no filter is provided",
			expectedCode: http.StatusBadRequest,
		},
		{
			desc:         "Should reject if conflicting action filters are provided",
			filters:      "?actionPrefix=grafana-test-app&action=grafana-test-app.projects:read",
			expectedCode: http.StatusBadRequest,
		},
		{
			desc:           "Should work with valid namespacedId filter provided",
			filters:        "?namespacedId=service-account:2",
			permissions:    map[int64][]ac.Permission{2: {{Action: "users:read", Scope: "users:*"}}},
			expectedCode:   http.StatusOK,
			expectedOutput: map[int64]map[string][]string{2: {"users:read": {"users:*"}}},
		},
		{
			desc:           "Should reduce permissions",
			filters:        "?namespacedId=service-account:2",
			permissions:    map[int64][]ac.Permission{2: {{Action: "users:read", Scope: "users:id:1"}, {Action: "users:read", Scope: "users:*"}}},
			expectedCode:   http.StatusOK,
			expectedOutput: map[int64]map[string][]string{2: {"users:read": {"users:*"}}},
		},
		{
			desc:    "Should work with valid action prefix filter",
			filters: "?actionPrefix=users:",
			permissions: map[int64][]ac.Permission{
				1: {{Action: "users:write", Scope: "users:id:1"}},
				2: {{Action: "users:read", Scope: "users:id:2"}},
			},
			expectedCode: http.StatusOK,
			expectedOutput: map[int64]map[string][]string{
				1: {"users:write": {"users:id:1"}},
				2: {"users:read": {"users:id:2"}},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			acSvc := actest.FakeService{ExpectedUsersPermissions: tt.permissions}
			accessControl := actest.FakeAccessControl{ExpectedEvaluate: true} // Always allow access to the endpoint
			api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, featuremgmt.WithFeatures(featuremgmt.FlagAccessControlOnCall))
			api.RegisterAPIEndpoints()

			server := webtest.NewServer(t, api.RouteRegister)
			url := "/api/access-control/users/permissions/search" + tt.filters

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
				var output map[int64]map[string][]string
				err := json.NewDecoder(res.Body).Decode(&output)
				require.NoError(t, err)
				require.Equal(t, tt.expectedOutput, output)
			}
		})
	}
}
