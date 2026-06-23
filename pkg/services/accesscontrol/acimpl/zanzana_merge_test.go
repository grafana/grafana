package acimpl

import (
	"context"
	"errors"
	"sort"
	"sync"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/client"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeZanzanaClient struct {
	client.NoopClient
	listResp  *authzv1.ListResponse
	listErr   error
	queryResp *authzextv1.QueryResponse
	queryErr  error
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

func (f *fakeZanzanaClient) Query(_ context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	return f.queryResp, f.queryErr
}

type countingZanzanaClient struct {
	fakeZanzanaClient
	mu         sync.Mutex
	queryCalls int
}

func (c *countingZanzanaClient) Query(ctx context.Context, req *authzextv1.QueryRequest) (*authzextv1.QueryResponse, error) {
	c.mu.Lock()
	c.queryCalls++
	c.mu.Unlock()
	return c.fakeZanzanaClient.Query(ctx, req)
}

func (c *countingZanzanaClient) QueryCallCount() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.queryCalls
}

func testZanzanaQueryResponse() *authzextv1.QueryResponse {
	grant := common.ToAuthzExtTupleKey(common.NewResourceTuple(
		"user:user_test_uid",
		common.RelationGet,
		"dashboard.grafana.app",
		"dashboards",
		"",
		"zanzana-dash",
	))
	return &authzextv1.QueryResponse{
		Result: &authzextv1.QueryResponse_UserPermissions{
			UserPermissions: &authzextv1.ListUserPermissionsResult{
				Grants: []*authzextv1.TupleKey{grant},
			},
		},
	}
}

func sortPermissions(perms []accesscontrol.Permission) {
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
		a        map[int64][]accesscontrol.Permission
		b        map[int64][]accesscontrol.Permission
		expected map[int64][]accesscontrol.Permission
	}{
		{
			name:     "both empty",
			a:        map[int64][]accesscontrol.Permission{},
			b:        map[int64][]accesscontrol.Permission{},
			expected: map[int64][]accesscontrol.Permission{},
		},
		{
			name: "disjoint users",
			a: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:*"}},
			},
			b: map[int64][]accesscontrol.Permission{
				2: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			expected: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:*"}},
				2: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
		},
		{
			name: "same user duplicate permissions are deduplicated",
			a: map[int64][]accesscontrol.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			b: map[int64][]accesscontrol.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			expected: map[int64][]accesscontrol.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
		},
		{
			name: "same user different permissions are merged",
			a: map[int64][]accesscontrol.Permission{
				1: {{Action: "teams:read", Scope: "teams:*"}},
			},
			b: map[int64][]accesscontrol.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			expected: map[int64][]accesscontrol.Permission{
				1: {
					{Action: "teams:read", Scope: "teams:*"},
					{Action: "dashboards:read", Scope: "dashboards:uid:abc"},
				},
			},
		},
		{
			name: "b only has users",
			a:    map[int64][]accesscontrol.Permission{},
			b: map[int64][]accesscontrol.Permission{
				5: {{Action: "folders:read", Scope: "folders:uid:xyz"}},
			},
			expected: map[int64][]accesscontrol.Permission{
				5: {{Action: "folders:read", Scope: "folders:uid:xyz"}},
			},
		},
		{
			name: "same action different scopes are kept",
			a: map[int64][]accesscontrol.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:abc"}},
			},
			b: map[int64][]accesscontrol.Permission{
				1: {{Action: "dashboards:read", Scope: "dashboards:uid:def"}},
			},
			expected: map[int64][]accesscontrol.Permission{
				1: {
					{Action: "dashboards:read", Scope: "dashboards:uid:abc"},
					{Action: "dashboards:read", Scope: "dashboards:uid:def"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := MergePermissions(tt.a, tt.b)
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

func TestMergeUserPermissions(t *testing.T) {
	tests := []struct {
		name     string
		legacy   []accesscontrol.Permission
		zanzana  []accesscontrol.Permission
		expected []accesscontrol.Permission
	}{
		{
			name:     "dedup identical action and scope",
			legacy:   []accesscontrol.Permission{{Action: "a", Scope: "s"}},
			zanzana:  []accesscontrol.Permission{{Action: "a", Scope: "s"}},
			expected: []accesscontrol.Permission{{Action: "a", Scope: "s"}},
		},
		{
			name:     "union different scopes for same action",
			legacy:   []accesscontrol.Permission{{Action: "a", Scope: "s1"}},
			zanzana:  []accesscontrol.Permission{{Action: "a", Scope: "s2"}},
			expected: []accesscontrol.Permission{{Action: "a", Scope: "s1"}, {Action: "a", Scope: "s2"}},
		},
		{
			name:     "zanzana only adds new permissions",
			legacy:   []accesscontrol.Permission{{Action: "teams:read", Scope: "teams:*"}},
			zanzana:  []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:x"}},
			expected: []accesscontrol.Permission{{Action: "teams:read", Scope: "teams:*"}, {Action: "dashboards:read", Scope: "dashboards:uid:x"}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			legacy := append([]accesscontrol.Permission(nil), tt.legacy...)
			got := MergeUserPermissions(legacy, tt.zanzana)
			sortPermissions(got)
			expected := append([]accesscontrol.Permission(nil), tt.expected...)
			sortPermissions(expected)
			require.Equal(t, expected, got)
		})
	}
}

func TestZanzanaPermissionResolver_MergeCurrentUser(t *testing.T) {
	legacy := []accesscontrol.Permission{{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}}

	t.Run("nil resolver returns legacy unchanged", func(t *testing.T) {
		var r *ZanzanaPermissionResolver
		got := r.MergeCurrentUser(context.Background(), &user.SignedInUser{}, legacy, log.New("test"))
		require.Equal(t, legacy, got)
	})

	t.Run("zanzana failure returns legacy only", func(t *testing.T) {
		r := NewZanzanaPermissionResolver(&fakeZanzanaClient{queryErr: errors.New("zanzana unavailable")}, &usertest.FakeUserService{}, nil, false, nil)
		got := r.MergeCurrentUser(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "user_test_uid"}, legacy, log.New("test"))
		require.Equal(t, legacy, got)
	})

	t.Run("success unions zanzana permissions", func(t *testing.T) {
		grant := common.ToAuthzExtTupleKey(common.NewResourceTuple(
			"user:user_test_uid",
			common.RelationGet,
			"dashboard.grafana.app",
			"dashboards",
			"",
			"zanzana-dash",
		))
		r := NewZanzanaPermissionResolver(&fakeZanzanaClient{
			queryResp: &authzextv1.QueryResponse{
				Result: &authzextv1.QueryResponse_UserPermissions{
					UserPermissions: &authzextv1.ListUserPermissionsResult{
						Grants: []*authzextv1.TupleKey{grant},
					},
				},
			},
		}, &usertest.FakeUserService{}, nil, false, nil)
		got := r.MergeCurrentUser(context.Background(), &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "user_test_uid"}, legacy, log.New("test"))
		require.Contains(t, got, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:legacy"})
		require.Contains(t, got, accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:zanzana-dash"})
	})
}

func TestZanzanaPermissionResolver_MergeSearch(t *testing.T) {
	legacy := map[int64][]accesscontrol.Permission{
		2: {{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}},
	}

	t.Run("nil resolver returns legacy unchanged", func(t *testing.T) {
		var r *ZanzanaPermissionResolver
		got := r.MergeSearch(context.Background(), &user.SignedInUser{OrgID: 1}, 1, accesscontrol.SearchOptions{}, legacy, log.New("test"))
		require.Equal(t, legacy, got)
	})

	t.Run("zanzana failure returns legacy only", func(t *testing.T) {
		mockUserSvc := usertest.NewMockService(t)
		mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 2}).Return(&user.User{ID: 2, UID: "user_2_uid"}, nil).Maybe()
		r := NewZanzanaPermissionResolver(&fakeZanzanaClient{listErr: errors.New("zanzana unavailable")}, mockUserSvc, nil, false, nil)
		got := r.MergeSearch(context.Background(), &user.SignedInUser{OrgID: 1}, 1, accesscontrol.SearchOptions{Action: "dashboards:read", UserID: 2}, legacy, log.New("test"))
		require.Equal(t, legacy, got)
	})

	t.Run("success unions and dedups per user", func(t *testing.T) {
		base := map[int64][]accesscontrol.Permission{
			2: {{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}},
		}
		mockUserSvc := usertest.NewMockService(t)
		mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 2}).Return(&user.User{ID: 2, UID: "user_2_uid"}, nil)
		// "legacy" overlaps an existing scope (must dedup), "zanzana" is new (must be added).
		r := NewZanzanaPermissionResolver(&fakeZanzanaClient{listResp: &authzv1.ListResponse{Items: []string{"legacy", "zanzana"}}}, mockUserSvc, nil, false, nil)

		got := r.MergeSearch(context.Background(), &user.SignedInUser{OrgID: 1}, 1, accesscontrol.SearchOptions{Action: "dashboards:read", UserID: 2}, base, log.New("test"))

		require.Contains(t, got, int64(2))
		require.ElementsMatch(t, []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "dashboards:uid:legacy"},
			{Action: "dashboards:read", Scope: "dashboards:uid:zanzana"},
		}, got[2])
	})
}

func setupServiceWithFakeStore(t *testing.T, store accesscontrol.Store, zClient zanzana.Client, userSvc user.Service) *Service {
	cfg := setting.NewCfg()
	svc := ProvideOSSService(
		cfg, store, resourcepermissions.NewActionSetService(), localcache.ProvideService(),
		featuremgmt.WithFeatures(featuremgmt.FlagZanzanaMergeUserPermissions), tracing.InitializeTracerForTest(),
		nil, permreg.ProvidePermissionRegistry(), nil,
	)
	if zClient != nil {
		svc.zanzanaResolver = NewZanzanaPermissionResolver(zClient, userSvc, nil, false, svc.actionResolver)
	}
	return svc
}

func setupServiceWithPermissionCache(t *testing.T, store accesscontrol.Store, zClient zanzana.Client, userSvc user.Service, cacheEnabled bool) *Service {
	svc := setupServiceWithFakeStore(t, store, zClient, userSvc)
	svc.cfg.RBAC.PermissionCache = cacheEnabled
	return svc
}

func testSignedInUser() *user.SignedInUser {
	return &user.SignedInUser{
		OrgID:       1,
		UserID:      1,
		UserUID:     "user_test_uid",
		Permissions: map[int64]map[string][]string{},
	}
}

func TestService_GetUserPermissions_CachesZanzanaPermissions(t *testing.T) {
	store := &actest.FakeStore{
		ExpectedUserPermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "dashboards:uid:legacy"},
		},
	}
	zClient := &countingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			queryResp: testZanzanaQueryResponse(),
		},
	}
	svc := setupServiceWithPermissionCache(t, store, zClient, &usertest.FakeUserService{}, true)
	siu := testSignedInUser()

	_, err := svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	firstCalls := zClient.QueryCallCount()
	require.NotZero(t, firstCalls, "first resolve should call Zanzana ListUserPermissions")

	_, err = svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	require.Equal(t, firstCalls, zClient.QueryCallCount(), "cached second call should not re-resolve Zanzana permissions")
}

func TestService_GetUserPermissions_ReloadCacheBypassesZanzanaCache(t *testing.T) {
	store := &actest.FakeStore{}
	zClient := &countingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			queryResp: testZanzanaQueryResponse(),
		},
	}
	svc := setupServiceWithPermissionCache(t, store, zClient, &usertest.FakeUserService{}, true)
	siu := testSignedInUser()

	_, err := svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	firstCalls := zClient.QueryCallCount()

	_, err = svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{ReloadCache: true})
	require.NoError(t, err)
	require.Greater(t, zClient.QueryCallCount(), firstCalls, "ReloadCache should bypass Zanzana cache")
}

func TestService_GetUserPermissions_ClearUserPermissionCacheBypassesZanzanaCache(t *testing.T) {
	store := &actest.FakeStore{}
	zClient := &countingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			queryResp: testZanzanaQueryResponse(),
		},
	}
	svc := setupServiceWithPermissionCache(t, store, zClient, &usertest.FakeUserService{}, true)
	siu := testSignedInUser()

	_, err := svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	firstCalls := zClient.QueryCallCount()

	svc.ClearUserPermissionCache(siu)

	_, err = svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	require.Greater(t, zClient.QueryCallCount(), firstCalls, "ClearUserPermissionCache should invalidate Zanzana cache")
}

func TestService_GetUserPermissions_DoesNotCacheZanzanaWhenPermissionCacheDisabled(t *testing.T) {
	store := &actest.FakeStore{}
	zClient := &countingZanzanaClient{
		fakeZanzanaClient: fakeZanzanaClient{
			queryResp: testZanzanaQueryResponse(),
		},
	}
	svc := setupServiceWithPermissionCache(t, store, zClient, &usertest.FakeUserService{}, false)
	siu := testSignedInUser()

	_, err := svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	firstCalls := zClient.QueryCallCount()
	require.NotZero(t, firstCalls)

	_, err = svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{})
	require.NoError(t, err)
	require.Greater(t, zClient.QueryCallCount(), firstCalls, "PermissionCache disabled should resolve Zanzana on every call")
}

func TestService_SearchUsersPermissions_MergesLegacyAndZanzana(t *testing.T) {
	store := &actest.FakeStore{
		ExpectedUsersPermissions: map[int64][]accesscontrol.Permission{
			2: {{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}},
		},
		ExpectedUsersRoles: map[int64][]string{
			2: {"Viewer"},
		},
	}
	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 2}).Return(&user.User{ID: 2, UID: "user_2_uid"}, nil)

	zClient := &fakeZanzanaClient{
		listResp: &authzv1.ListResponse{Items: []string{"zanzana"}},
	}

	svc := setupServiceWithFakeStore(t, store, zClient, mockUserSvc)

	siu := &user.SignedInUser{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{},
	}

	options := accesscontrol.SearchOptions{
		Action: "dashboards:read",
		UserID: 2,
	}

	res, err := svc.SearchUsersPermissions(context.Background(), siu, options)
	require.NoError(t, err)

	require.Contains(t, res, int64(2))
	require.ElementsMatch(t, []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:uid:legacy"},
		{Action: "dashboards:read", Scope: "dashboards:uid:zanzana"},
	}, res[2])
}

func TestService_SearchUsersPermissions_UsesLegacyWhenZanzanaFails(t *testing.T) {
	store := &actest.FakeStore{
		ExpectedUsersPermissions: map[int64][]accesscontrol.Permission{
			2: {{Action: "dashboards:read", Scope: "dashboards:uid:legacy"}},
		},
		ExpectedUsersRoles: map[int64][]string{
			2: {"Viewer"},
		},
	}
	mockUserSvc := usertest.NewMockService(t)
	mockUserSvc.On("GetByID", mock.Anything, &user.GetUserByIDQuery{ID: 2}).Return(&user.User{ID: 2, UID: "user_2_uid"}, nil)

	zClient := &fakeZanzanaClient{
		listErr: errors.New("zanzana unavailable"),
	}

	svc := setupServiceWithFakeStore(t, store, zClient, mockUserSvc)

	siu := &user.SignedInUser{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{},
	}

	options := accesscontrol.SearchOptions{
		Action: "dashboards:read",
		UserID: 2,
	}

	res, err := svc.SearchUsersPermissions(context.Background(), siu, options)
	require.NoError(t, err)

	require.Contains(t, res, int64(2))
	require.ElementsMatch(t, []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:uid:legacy"},
	}, res[2])
}

func TestService_GetUserPermissions_MergesLegacyAndZanzana(t *testing.T) {
	store := &actest.FakeStore{
		ExpectedUserPermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "dashboards:uid:legacy"},
		},
	}
	grant := common.ToAuthzExtTupleKey(common.NewResourceTuple(
		"user:user_test_uid",
		common.RelationGet,
		"dashboard.grafana.app",
		"dashboards",
		"",
		"zanzana-dash",
	))
	zClient := &fakeZanzanaClient{
		queryResp: &authzextv1.QueryResponse{
			Result: &authzextv1.QueryResponse_UserPermissions{
				UserPermissions: &authzextv1.ListUserPermissionsResult{
					Grants: []*authzextv1.TupleKey{grant},
				},
			},
		},
	}

	svc := setupServiceWithFakeStore(t, store, zClient, &usertest.FakeUserService{})

	siu := &user.SignedInUser{
		OrgID:       1,
		UserID:      1,
		UserUID:     "user_test_uid",
		Permissions: map[int64]map[string][]string{},
	}

	perms, err := svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{ReloadCache: true})
	require.NoError(t, err)

	var hasLegacy, hasZanzana bool
	for _, p := range perms {
		if p.Action == "dashboards:read" && p.Scope == "dashboards:uid:legacy" {
			hasLegacy = true
		}
		if p.Action == "dashboards:read" && p.Scope == "dashboards:uid:zanzana-dash" {
			hasZanzana = true
		}
	}
	require.True(t, hasLegacy)
	require.True(t, hasZanzana)
}

func TestService_GetUserPermissions_UsesLegacyWhenZanzanaFails(t *testing.T) {
	store := &actest.FakeStore{
		ExpectedUserPermissions: []accesscontrol.Permission{
			{Action: "dashboards:read", Scope: "dashboards:uid:legacy"},
		},
	}
	zClient := &fakeZanzanaClient{
		queryErr: errors.New("zanzana unavailable"),
	}

	svc := setupServiceWithFakeStore(t, store, zClient, &usertest.FakeUserService{})

	siu := &user.SignedInUser{
		OrgID:       1,
		UserID:      1,
		UserUID:     "user_test_uid",
		Permissions: map[int64]map[string][]string{},
	}

	perms, err := svc.GetUserPermissions(context.Background(), siu, accesscontrol.Options{ReloadCache: true})
	require.NoError(t, err)

	var hasLegacy, hasZanzana bool
	for _, p := range perms {
		if p.Action == "dashboards:read" && p.Scope == "dashboards:uid:legacy" {
			hasLegacy = true
		}
		if p.Action == "dashboards:read" && p.Scope == "dashboards:uid:zanzana-dash" {
			hasZanzana = true
		}
	}
	require.True(t, hasLegacy)
	require.False(t, hasZanzana)
}
