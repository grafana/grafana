package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type fakeZanzanaClient struct {
	client.NoopClient
	listResp *authzv1.ListResponse
	listErr  error
}

func (f *fakeZanzanaClient) Check(context.Context, authlib.AuthInfo, authlib.CheckRequest, string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{}, nil
}

func (f *fakeZanzanaClient) Compile(context.Context, authlib.AuthInfo, authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return nil, authlib.NoopZookie{}, nil
}

func (f *fakeZanzanaClient) BatchCheck(context.Context, authlib.AuthInfo, authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, nil
}

func (f *fakeZanzanaClient) List(context.Context, *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	return f.listResp, f.listErr
}

func (f *fakeZanzanaClient) Read(context.Context, *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	return nil, nil
}

func (f *fakeZanzanaClient) Write(context.Context, *authzextv1.WriteRequest) error {
	return nil
}

func (f *fakeZanzanaClient) Mutate(context.Context, *authzextv1.MutateRequest) error {
	return nil
}

func (f *fakeZanzanaClient) Query(context.Context, *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	return nil, nil
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
			api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, nil, nil)
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
			api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, nil, nil)
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
		expectedOutput map[int64]map[string][]string
		expectedCode   int
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
				2: {"dashboards:write": {"dashboards:*"}},
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
				2: {"teams:read": {"teams:id:2"}},
			},
		},
		{
			desc:         "Should return 500 when service returns error",
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
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			acSvc := actest.FakeService{
				ExpectedUsersPermissions: tt.permissions,
				ExpectedErr:              tt.serviceErr,
			}

			accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
			mockUserSvc := usertest.NewMockService(t)
			mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user_2_uid"}).Return(&user.User{ID: 2}, nil).Maybe()
			mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "non_existent_uid"}).Return(nil, user.ErrUserNotFound).Maybe()
			mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "sa_abc123"}).Return(&user.User{ID: 3, IsServiceAccount: true}, nil).Maybe()
			api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, nil, nil)
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

func sortPermissions(perms []ac.Permission) {
	sort.Slice(perms, func(i, j int) bool {
		if perms[i].Action != perms[j].Action {
			return perms[i].Action < perms[j].Action
		}
		return perms[i].Scope < perms[j].Scope
	})
}

func TestMergePermissions(t *testing.T) {
	tests := []struct {
		name     string
		a        map[int64][]ac.Permission
		b        map[int64][]ac.Permission
		expected map[int64][]ac.Permission
	}{
		{
			name:     "both empty",
			a:        map[int64][]ac.Permission{},
			b:        map[int64][]ac.Permission{},
			expected: map[int64][]ac.Permission{},
		},
		{
			name: "disjoint users",
			a: map[int64][]ac.Permission{
				1: {{Action: "teams:read", Scope: "teams:*"}},
			},
			b: map[int64][]ac.Permission{
				2: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			expected: map[int64][]ac.Permission{
				1: {{Action: "teams:read", Scope: "teams:*"}},
				2: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
		},
		{
			name: "same user duplicate permissions are deduplicated",
			a: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			b: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			expected: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
		},
		{
			name: "same user different permissions are merged",
			a: map[int64][]ac.Permission{
				1: {{Action: "teams:read", Scope: "teams:*"}},
			},
			b: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			expected: map[int64][]ac.Permission{
				1: {
					{Action: "teams:read", Scope: "teams:*"},
					{Action: "dashboards:read", Scope: "dashboards:uid:abc"},
				},
			},
		},
		{
			name: "b only has users",
			a:    map[int64][]ac.Permission{},
			b: map[int64][]ac.Permission{
				5: {{Action: "folders:read", Scope: "folders:uid:xyz"}},
			},
			expected: map[int64][]ac.Permission{
				5: {{Action: "folders:read", Scope: "folders:uid:xyz"}},
			},
		},
		{
			name: "same action different scopes are kept",
			a: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			b: map[int64][]ac.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:def"}},
			},
			expected: map[int64][]ac.Permission{
				1: {
					{Action: "dashboards:read", Scope: "dashboards:uid:abc"},
					{Action: "dashboards:read", Scope: "dashboards:uid:def"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := mergePermissions(tt.a, tt.b)
			require.Len(t, result, len(tt.expected))
			for userID, expectedPerms := range tt.expected {
				gotPerms, ok := result[userID]
				require.True(t, ok, "missing user %d", userID)
				sortPermissions(gotPerms)
				sortPermissions(expectedPerms)
				require.Equal(t, expectedPerms, gotPerms)
			}
		})
	}
}

func TestAccessControlAPI_searchUsersPermissions_MergesLegacyAndZanzana(t *testing.T) {
	acSvc := actest.FakeService{
		ExpectedUsersPermissions: map[int64][]ac.Permission{
			2: {{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}},
		},
	}
	accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user_2_uid"}).Return(&user.User{ID: 2}, nil)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 2}).Return(&user.User{ID: 2, UID: "user_2_uid"}, nil)

	zClient := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{Items: []string{"zanzana"}},
	}
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
	api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, features, zClient)
	api.RegisterAPIEndpoints()

	server := webtest.NewServer(t, api.RouteRegister)
	req := server.NewGetRequest("/api/access-control/users/permissions/search?action=dashboards:read&namespacedId=user:user_2_uid")
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
	require.Contains(t, output, int64(2))
	require.ElementsMatch(t, []string{"dashboards:uid:legacy", "dashboards:uid:zanzana"}, output[2]["dashboards:read"])
}

func TestAccessControlAPI_searchUsersPermissions_UsesLegacyWhenZanzanaFails(t *testing.T) {
	acSvc := actest.FakeService{
		ExpectedUsersPermissions: map[int64][]ac.Permission{
			2: {{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}},
		},
	}
	accessControl := actest.FakeAccessControl{ExpectedEvaluate: true}
	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByUID", mock.Anything, &user.GetUserByUIDQuery{UID: "user_2_uid"}).Return(&user.User{ID: 2}, nil)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 2}).Return(&user.User{ID: 2, UID: "user_2_uid"}, nil)

	zClient := &fakeZanzanaClient{
		listErr: errors.New("zanzana unavailable"),
	}
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
	api := NewAccessControlAPI(routing.NewRouteRegister(), accessControl, acSvc, mockUserSvc, features, zClient)
	api.RegisterAPIEndpoints()

	server := webtest.NewServer(t, api.RouteRegister)
	req := server.NewGetRequest("/api/access-control/users/permissions/search?action=dashboards:read&namespacedId=user:user_2_uid")
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
	require.Equal(t, map[int64]map[string][]string{
		2: {"dashboards:read": {"dashboards:uid:legacy"}},
	}, output)
}

func TestMergeUserPermissions(t *testing.T) {
	tests := []struct {
		name     string
		legacy   []ac.Permission
		zanzana  []ac.Permission
		expected []ac.Permission
	}{
		{
			name:     "dedup identical action and scope",
			legacy:   []ac.Permission{{Action: "a", Scope: "s"}},
			zanzana:  []ac.Permission{{Action: "a", Scope: "s"}},
			expected: []ac.Permission{{Action: "a", Scope: "s"}},
		},
		{
			name:     "union different scopes for same action",
			legacy:   []ac.Permission{{Action: "a", Scope: "s1"}},
			zanzana:  []ac.Permission{{Action: "a", Scope: "s2"}},
			expected: []ac.Permission{{Action: "a", Scope: "s1"}, {Action: "a", Scope: "s2"}},
		},
		{
			name:     "zanzana only adds new permissions",
			legacy:   []ac.Permission{{Action: "teams:read", Scope: "teams:*"}},
			zanzana:  []ac.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:x"}},
			expected: []ac.Permission{{Action: "teams:read", Scope: "teams:*"}, {Action: "dashboards:read", Scope: "dashboards:uid:x"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			legacy := append([]ac.Permission(nil), tt.legacy...)
			got := mergeUserPermissions(legacy, tt.zanzana)
			sortPermissions(got)
			expected := append([]ac.Permission(nil), tt.expected...)
			sortPermissions(expected)
			require.Equal(t, expected, got)
		})
	}
}

func TestAPI_getUserActions_MergesLegacyAndZanzana(t *testing.T) {
	acSvc := actest.FakeService{
		ExpectedPermissions: []ac.Permission{
			{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
		},
	}
	zClient := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{Items: []string{"zanzana-dash"}},
	}
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
	api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, features, zClient)
	api.RegisterAPIEndpoints()

	server := webtest.NewServer(t, api.RouteRegister)
	req := server.NewGetRequest("/api/access-control/user/actions")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID:       1,
		UserID:      1,
		UserUID:     "user_test_uid",
		Permissions: map[int64]map[string][]string{},
	})
	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode)

	var output util.DynMap
	require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
	require.True(t, output[datasources.ActionRead].(bool))
	require.Contains(t, output, "dashboards:read")
}

func TestAPI_getUserActions_UsesLegacyWhenZanzanaFails(t *testing.T) {
	acSvc := actest.FakeService{
		ExpectedPermissions: []ac.Permission{
			{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
		},
	}
	zClient := &fakeZanzanaClient{
		listErr: errors.New("zanzana unavailable"),
	}
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
	api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, features, zClient)
	api.RegisterAPIEndpoints()

	server := webtest.NewServer(t, api.RouteRegister)
	req := server.NewGetRequest("/api/access-control/user/actions")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID:       1,
		UserID:      1,
		UserUID:     "user_test_uid",
		Permissions: map[int64]map[string][]string{},
	})
	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode)

	var output util.DynMap
	require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
	require.Equal(t, util.DynMap{datasources.ActionRead: true}, output)
}

func TestAPI_getUserPermissions_MergesLegacyAndZanzana(t *testing.T) {
	acSvc := actest.FakeService{
		ExpectedPermissions: []ac.Permission{
			{Action: datasources.ActionRead, Scope: datasources.ScopeAll},
		},
	}
	zClient := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{Items: []string{"zanzana-dash"}},
	}
	features := featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions)
	api := NewAccessControlAPI(routing.NewRouteRegister(), actest.FakeAccessControl{}, acSvc, &usertest.FakeUserService{}, features, zClient)
	api.RegisterAPIEndpoints()

	server := webtest.NewServer(t, api.RouteRegister)
	req := server.NewGetRequest("/api/access-control/user/permissions")
	webtest.RequestWithSignedInUser(req, &user.SignedInUser{
		OrgID:       1,
		UserID:      1,
		UserUID:     "user_test_uid",
		Permissions: map[int64]map[string][]string{},
	})
	res, err := server.Send(req)
	defer func() { require.NoError(t, res.Body.Close()) }()
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode)

	var output util.DynMap
	require.NoError(t, json.NewDecoder(res.Body).Decode(&output))
	require.Contains(t, output, datasources.ActionRead)
	require.Contains(t, output, "dashboards:read")

	dsScopes, ok := output[datasources.ActionRead].([]any)
	require.True(t, ok)
	require.Contains(t, dsScopes, datasources.ScopeAll)
}
