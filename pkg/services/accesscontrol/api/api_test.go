package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web/webtest"
)

// buildFakeK8sResolver creates a k8sPermissionResolver backed by a dynamicfake client.
// Each user ID in perms is assigned UID "uid-{id}". When fail is true the resolver has no
// clients, causing SearchUsersPermissions to return an error.
func buildFakeK8sResolver(t *testing.T, perms map[int64][]ac.Permission, fail bool, userSvc user.Service) *k8sPermissionResolver {
	t.Helper()
	if fail {
		return &k8sPermissionResolver{log: log.New("test")}
	}

	const ns = "default"
	var objects []runtime.Object
	for id, ps := range perms {
		uid := fmt.Sprintf("uid-%d", id)
		objects = append(objects, makeUser(uid, ns, ""))
		if len(ps) > 0 {
			roleName := fmt.Sprintf("role-%s", uid)
			objects = append(objects, makeRole(roleName, ns, ps...))
			objects = append(objects, makeRoleBinding(
				fmt.Sprintf("user-%s", uid), ns, uid,
				roleRef(iamv0.RoleBindingSpecRoleRefKindRole, roleName),
			))
		}
	}

	return &k8sPermissionResolver{
		dynamicClient: newFakeDynamic(t, objects...),
		userService:   userSvc,
		log:           log.New("test"),
	}
}

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
			api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, nil, nil, nil)
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
			api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, nil, nil, nil)
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
				for k, v := range output {
					scopes, ok := tt.expectedOutput[k]
					require.True(t, ok)
					require.ElementsMatch(t, scopes, v)
				}
			}
		})
	}
}

func TestAccessControlAPI_searchUsersPermissions(t *testing.T) {
	type testCase struct {
		desc           string
		permissions    map[int64][]ac.Permission
		filters        string
		expectedCode   int
		expectedOutput map[int64]map[string][]string
		serviceErr     error
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
			desc:           "Should resolve UID based identifier to the corresponding ID",
			filters:        "?namespacedId=user:user_2_uid",
			permissions:    map[int64][]ac.Permission{2: {{Action: "users:read", Scope: "users:*"}}},
			expectedCode:   http.StatusOK,
			expectedOutput: map[int64]map[string][]string{2: {"users:read": {"users:*"}}},
		},
		{
			desc:         "Should fail if cannot resolve UID based identifier",
			filters:      "?namespacedId=user:non_existent_uid",
			permissions:  map[int64][]ac.Permission{2: {{Action: "users:read", Scope: "users:*"}}},
			expectedCode: http.StatusBadRequest,
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
		{
			desc:         "Should return 500 for invalid namespacedId format",
			filters:      "?namespacedId=invalid_format",
			expectedCode: http.StatusInternalServerError,
		},
		{
			desc:         "Should return 500 for unsupported identity type",
			filters:      "?namespacedId=team:1",
			expectedCode: http.StatusInternalServerError,
		},
		{
			desc:    "Should accept exact action filter",
			filters: "?action=dashboards:read",
			permissions: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:*"}},
				2: {{Action: "dashboards:write", Scope: "dashboards:*"}},
			},
			expectedCode: http.StatusOK,
			expectedOutput: map[int64]map[string][]string{
				1: {"dashboards:read": {"dashboards:*"}},
			},
		},
		{
			desc:    "Should accept scope filter",
			filters: "?actionPrefix=teams:&scope=teams:id:1",
			permissions: map[int64][]ac.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}},
				2: {{Action: "teams:read", Scope: "teams:id:2"}},
			},
			expectedCode: http.StatusOK,
			expectedOutput: map[int64]map[string][]string{
				1: {"teams:read": {"teams:id:1"}},
			},
		},
		{
			desc:         "Should return 500 when backend returns error",
			filters:      "?actionPrefix=users:",
			serviceErr:   errors.New("database connection failed"),
			expectedCode: http.StatusInternalServerError,
		},
		{
			desc:           "Should return empty map when no users match",
			filters:        "?actionPrefix=nonexistent:",
			permissions:    map[int64][]ac.Permission{},
			expectedCode:   http.StatusOK,
			expectedOutput: map[int64]map[string][]string{},
		},
		{
			desc:           "Should resolve service-account UID",
			filters:        "?namespacedId=service-account:sa_abc123",
			permissions:    map[int64][]ac.Permission{3: {{Action: "users:read", Scope: "users:*"}}},
			expectedCode:   http.StatusOK,
			expectedOutput: map[int64]map[string][]string{3: {"users:read": {"users:*"}}},
		},
	}

	// setupUserSvc builds a mock user service with all UID/ID lookups needed by both paths.
	setupUserSvc := func(t *testing.T) *usertest.MockService {
		t.Helper()
		mockUserSvc := usertest.NewMockService(t)
		// UID lookups used by ComputeUserID (both paths)
		mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user_2_uid"}).Return(&user.User{ID: 2}, nil).Maybe()
		mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "non_existent_uid"}).Return(nil, user.ErrUserNotFound).Maybe()
		mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "sa_abc123"}).Return(&user.User{ID: 3, IsServiceAccount: true}, nil).Maybe()
		// ID→UID and UID→ID used by the K8s path
		for _, id := range []int64{1, 2, 3} {
			uid := fmt.Sprintf("uid-%d", id)
			mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: id}).Return(&user.User{ID: id, UID: uid}, nil).Maybe()
			mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: uid}).Return(&user.User{ID: id}, nil).Maybe()
		}
		return mockUserSvc
	}

	runCase := func(t *testing.T, tt testCase, expectedCode int, expectedOutput map[int64]map[string][]string, api *AccessControlAPI, namespace string) {
		t.Helper()
		server := webtest.NewServer(t, api.RouteRegister)
		req := server.NewGetRequest("/api/access-control/users/permissions/search" + tt.filters)
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:       1,
			Namespace:   namespace,
			Permissions: map[int64]map[string][]string{},
		})
		res, err := server.Send(req)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.NoError(t, err)
		require.Equal(t, expectedCode, res.StatusCode)
		if expectedCode == http.StatusOK {
			var output map[int64]map[string][]string
			require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
			require.Equal(t, expectedOutput, output)
		}
	}

	t.Run("legacy", func(t *testing.T) {
		for _, tt := range tests {
			t.Run(tt.desc, func(t *testing.T) {
				acSvc := actest.FakeService{ExpectedUsersPermissions: tt.permissions, ExpectedErr: tt.serviceErr}
				api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{ExpectedEvaluate: true}, acSvc, setupUserSvc(t), nil, nil, nil)
				api.RegisterAPIEndpoints()
				runCase(t, tt, tt.expectedCode, tt.expectedOutput, api, "")
			})
		}
	})

	t.Run("k8s", func(t *testing.T) {
		for _, tt := range tests {
			t.Run(tt.desc, func(t *testing.T) {
				userSvc := setupUserSvc(t)
				features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesAuthzRolesAndRoleBindingsRedirect, true)
				// acSvc should not be called on the K8s path for non-error cases
				api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{ExpectedEvaluate: true}, actest.FakeService{}, userSvc, features, &fakeRestConfigProvider{}, nil)
				api.k8sResolver = buildFakeK8sResolver(t, tt.permissions, tt.serviceErr != nil, userSvc)
				api.RegisterAPIEndpoints()

				runCase(t, tt, tt.expectedCode, tt.expectedOutput, api, "default")
			})
		}
	})
}

func TestAccessControlAPI_searchUsersPermissions_FeatureFlag(t *testing.T) {
	legacyPerms := map[int64][]ac.Permission{
		1: {{Action: "dashboards:read", Scope: "dashboards:*"}},
	}

	// mockUserSvc maps user ID 1 to UID "user-uid-1".
	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: int64(1)}).
		Return(&user.User{ID: 1, UID: "user-uid-1"}, nil).Maybe()
	mockUserSvc.On("GetByUID", mock.Anything, mock.Anything).
		Return(nil, user.ErrUserNotFound).Maybe()

	t.Run("flag OFF uses legacy path", func(t *testing.T) {
		acSvc := actest.FakeService{ExpectedUsersPermissions: legacyPerms}
		accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
		api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, nil, nil, nil)
		api.RegisterAPIEndpoints()

		server := webtest.NewServer(t, api.RouteRegister)
		req := server.NewGetRequest("/api/access-control/users/permissions/search?namespacedId=user:1")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{},
		})
		res, err := server.Send(req)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)

		var output map[int64]map[string][]string
		require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
		require.Equal(t, map[string][]string{"dashboards:read": {"dashboards:*"}}, output[1])
	})

	t.Run("flag ON uses K8s path", func(t *testing.T) {
		// Build a fake resolver with user "user-uid-1" having folders:read.
		// (Different from the legacy dashboards:read to prove the K8s path is taken.)
		const ns = "default"
		fakeDyn := newFakeDynamic(t,
			makeUser("user-uid-1", ns, ""),
			makeRole("role-user-uid-1", ns, ac.Permission{Action: "folders:read", Scope: "folders:*"}),
			makeRoleBinding("user-user-uid-1", ns, "user-uid-1",
				roleRef(iamv0.RoleBindingSpecRoleRefKindRole, "role-user-uid-1"),
			),
		)
		resolver := &k8sPermissionResolver{
			dynamicClient: fakeDyn,
			userService:   mockUserSvc,
			log:           log.New("test"),
		}

		acSvc := actest.FakeService{ExpectedUsersPermissions: legacyPerms}
		accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesAuthzRolesAndRoleBindingsRedirect, true)
		api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, features, &fakeRestConfigProvider{}, nil)
		api.k8sResolver = resolver
		api.RegisterAPIEndpoints()

		server := webtest.NewServer(t, api.RouteRegister)
		req := server.NewGetRequest("/api/access-control/users/permissions/search?namespacedId=user:1")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:       1,
			Namespace:   "default",
			Permissions: map[int64]map[string][]string{},
		})
		res, err := server.Send(req)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)

		var output map[int64]map[string][]string
		require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
		// K8s path returns folders:read, not the legacy dashboards:read.
		require.Equal(t, map[string][]string{"folders:read": {"folders:*"}}, output[1])
	})

	t.Run("flag ON returns error when K8s resolver fails", func(t *testing.T) {
		// Resolver with no clients → SearchUsersPermissions returns error.
		failResolver := &k8sPermissionResolver{log: log.New("test")}

		acSvc := actest.FakeService{ExpectedUsersPermissions: legacyPerms}
		accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesAuthzRolesAndRoleBindingsRedirect, true)
		api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, features, &fakeRestConfigProvider{}, nil)
		api.k8sResolver = failResolver
		api.RegisterAPIEndpoints()

		server := webtest.NewServer(t, api.RouteRegister)
		req := server.NewGetRequest("/api/access-control/users/permissions/search?namespacedId=user:1")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:       1,
			Namespace:   "default",
			Permissions: map[int64]map[string][]string{},
		})
		res, err := server.Send(req)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.NoError(t, err)
		require.Equal(t, http.StatusInternalServerError, res.StatusCode)
	})

	t.Run("flag ON without provider uses legacy path", func(t *testing.T) {
		acSvc := actest.FakeService{ExpectedUsersPermissions: legacyPerms}
		accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
		features := featuremgmt.WithFeatures(featuremgmt.FlagKubernetesAuthzRolesAndRoleBindingsRedirect, true)

		// No provider means no K8s resolver; OSS wiring should continue to use legacy path.
		api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, features, nil, nil)
		api.RegisterAPIEndpoints()

		server := webtest.NewServer(t, api.RouteRegister)
		req := server.NewGetRequest("/api/access-control/users/permissions/search?namespacedId=user:1")
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:       1,
			Permissions: map[int64]map[string][]string{},
		})
		res, err := server.Send(req)
		defer func() { require.NoError(t, res.Body.Close()) }()
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, res.StatusCode)

		var output map[int64]map[string][]string
		require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
		require.Equal(t, map[string][]string{"dashboards:read": {"dashboards:*"}}, output[1])
	})
}

func TestAccessControlAPI_searchUsersPermissions_LegacyAndK8sParity(t *testing.T) {
	type parityCase struct {
		name        string
		filters     string
		permissions map[int64][]ac.Permission
		expected    map[int64]map[string][]string
	}

	cases := []parityCase{
		{
			name:    "action prefix",
			filters: "?actionPrefix=users:",
			permissions: map[int64][]ac.Permission{
				1: {{Action: "users:read", Scope: "users:*"}},
				2: {{Action: "dashboards:read", Scope: "dashboards:*"}},
			},
			expected: map[int64]map[string][]string{
				1: {"users:read": {"users:*"}},
			},
		},
		{
			name:    "exact action and reduction",
			filters: "?action=dashboards:read",
			permissions: map[int64][]ac.Permission{
				1: {
					{Action: "dashboards:read", Scope: "dashboards:*"},
					{Action: "dashboards:read", Scope: "dashboards:id:1"},
				},
			},
			expected: map[int64]map[string][]string{
				1: {"dashboards:read": {"dashboards:*"}},
			},
		},
		{
			name:    "scope",
			filters: "?actionPrefix=teams:&scope=teams:id:1",
			permissions: map[int64][]ac.Permission{
				1: {{Action: "teams:read", Scope: "teams:id:1"}},
				2: {{Action: "teams:read", Scope: "teams:id:2"}},
			},
			expected: map[int64]map[string][]string{
				1: {"teams:read": {"teams:id:1"}},
			},
		},
	}

	run := func(t *testing.T, api *AccessControlAPI, filters string, namespace string) (int, map[int64]map[string][]string) {
		t.Helper()
		server := webtest.NewServer(t, api.RouteRegister)
		req := server.NewGetRequest("/api/access-control/users/permissions/search" + filters)
		webtest.RequestWithSignedInUser(req, &user.SignedInUser{
			OrgID:       1,
			Namespace:   namespace,
			Permissions: map[int64]map[string][]string{},
		})

		res, err := server.Send(req)
		require.NoError(t, err)
		defer func() { require.NoError(t, res.Body.Close()) }()

		if res.StatusCode != http.StatusOK {
			return res.StatusCode, nil
		}
		var output map[int64]map[string][]string
		require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
		return res.StatusCode, output
	}

	setupUserSvc := func(t *testing.T) *usertest.MockService {
		t.Helper()
		mockUserSvc := usertest.NewMockService(t)
		for _, id := range []int64{1, 2, 3} {
			uid := fmt.Sprintf("uid-%d", id)
			mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: id}).Return(&user.User{ID: id, UID: uid}, nil).Maybe()
			mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: uid}).Return(&user.User{ID: id}, nil).Maybe()
		}
		return mockUserSvc
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			legacy := NewAccessControlAPI(
				routing.NewRouteRegister(),
				actest.FakeAccessControl{ExpectedEvaluate: true},
				actest.FakeService{ExpectedUsersPermissions: tc.permissions},
				setupUserSvc(t),
				nil,
				nil,
				nil,
			)
			legacy.RegisterAPIEndpoints()

			userSvc := setupUserSvc(t)
			k8s := NewAccessControlAPI(
				routing.NewRouteRegister(),
				actest.FakeAccessControl{ExpectedEvaluate: true},
				actest.FakeService{},
				userSvc,
				featuremgmt.WithFeatures(featuremgmt.FlagKubernetesAuthzRolesAndRoleBindingsRedirect, true),
				&fakeRestConfigProvider{},
				nil,
			)
			k8s.k8sResolver = buildFakeK8sResolver(t, tc.permissions, false, userSvc)
			k8s.RegisterAPIEndpoints()

			legacyCode, legacyOut := run(t, legacy, tc.filters, "")
			k8sCode, k8sOut := run(t, k8s, tc.filters, "default")

			require.Equal(t, http.StatusOK, legacyCode)
			require.Equal(t, http.StatusOK, k8sCode)
			require.Equal(t, tc.expected, legacyOut)
			require.Equal(t, tc.expected, k8sOut)
			require.Equal(t, legacyOut, k8sOut)
		})
	}
}
