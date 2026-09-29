package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"

	"github.com/grafana/authlib/authn"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestService_GetUserPermissionsStreamsRBACSnapshot(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Editor", IsAdmin: true},
	}
	service.identityStore = &fakeIdentityStore{userTeams: []int64{7, 9}}
	permissionStore := &snapshotPermissionStore{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:write", Scope: "folders:uid:team"},
	}}
	service.permissionStore = permissionStore

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
		Options:   &authzv1.GetUserPermissionsOptions{Skipcache: true},
	}, stream)
	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:write", Scope: "folders:uid:team"},
		{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
	}, stream.responses[0].Permissions)
	require.Equal(t, store.PermissionsQuery{
		UserID:        42,
		TeamIDs:       []int64{7, 9},
		Role:          "Editor",
		IsServerAdmin: true,
	}, permissionStore.query)
}

func TestService_GetUserPermissionsUsesLocalEvaluator(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Editor", IsAdmin: true},
	}
	service.identityStore = &fakeIdentityStore{userTeams: []int64{7, 9}}
	service.permissionStore = &snapshotPermissionStore{permissions: []accesscontrol.Permission{{
		Action: "unexpected:read",
		Scope:  "unexpected:*",
	}}}
	evaluator := &recordingUserPermissionsEvaluator{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "dashboards:read", Scope: "dashboards:*"},
	}}
	service.userPermissionsEvaluator = evaluator

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
		Options:   &authzv1.GetUserPermissionsOptions{Skipcache: true},
	}, stream)

	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.Equal(t, []*authzv1.UserPermission{{Action: "dashboards:read", Scope: "dashboards:*"}}, stream.responses[0].Permissions)
	userID, err := evaluator.user.GetInternalID()
	require.NoError(t, err)
	require.Equal(t, int64(42), userID)
	require.Equal(t, "user:test-uid", evaluator.user.GetUID())
	require.Equal(t, int64(12), evaluator.user.GetOrgID())
	require.Equal(t, identity.RoleEditor, evaluator.user.GetOrgRole())
	require.True(t, evaluator.user.GetIsGrafanaAdmin())
	require.Equal(t, "org-12", evaluator.user.GetNamespace())
	require.Equal(t, []int64{7, 9}, evaluator.teams)
	require.Equal(t, accesscontrol.Options{ReloadCache: true, SkipZanzanaCache: true}, evaluator.options)
}

func TestService_GetUserPermissionsMergesZanzanaPermissions(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Viewer"},
	}
	service.identityStore = &fakeIdentityStore{userTeams: []int64{7}}
	service.permissionStore = &snapshotPermissionStore{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
	}}
	resolver := &recordingUserPermissionsResolver{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:write", Scope: "folders:uid:zanzana"},
	}}
	service.userPermissionsResolver = resolver

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
		Teams:     []string{"team-uid"},
	}, stream)

	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:write", Scope: "folders:uid:zanzana"},
		{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
	}, stream.responses[0].Permissions)
	require.Equal(t, []string{"team-uid"}, resolver.user.GetGroups())
}

func TestService_GetUserPermissionsMergesZanzanaPermissionsForAnonymous(t *testing.T) {
	service := setupService()
	service.permissionStore = &snapshotPermissionStore{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
	}}
	service.userPermissionsResolver = &recordingUserPermissionsResolver{permissions: []accesscontrol.Permission{
		{Action: "folders:write", Scope: "folders:uid:zanzana"},
	}}

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "anonymous:0",
	}, stream)

	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:write", Scope: "folders:uid:zanzana"},
		{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
	}, stream.responses[0].Permissions)
}

func TestService_GetUserPermissionsUsesRBACPermissionsWhenZanzanaFails(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Viewer"},
	}
	service.permissionStore = &snapshotPermissionStore{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
	}}
	service.userPermissionsResolver = &recordingUserPermissionsResolver{err: fmt.Errorf("zanzana unavailable")}

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
	}, stream)

	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
	}, stream.responses[0].Permissions)
}

func TestService_GetUserPermissionsDeduplicatesPermissions(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Viewer"},
	}
	service.permissionStore = &snapshotPermissionStore{permissions: []accesscontrol.Permission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "dashboards:read", Scope: "dashboards:uid:one"},
	}}

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
	}, stream)

	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.ElementsMatch(t, []*authzv1.UserPermission{
		{Action: "dashboards:read", Scope: "dashboards:*"},
		{Action: "dashboards:read", Scope: "dashboards:uid:one"},
		{Action: "folders:read", Scope: "folders:uid:sharedwithme"},
	}, stream.responses[0].Permissions)
}

func TestService_GetUserPermissionsExpandsActionSets(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Viewer"},
	}
	service.permissionStore = &snapshotPermissionStore{permissions: []accesscontrol.Permission{{
		Action: "dashboards:view",
		Scope:  "dashboards:*",
	}}}
	service.actionResolver = expandingActionResolver{}

	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
	}, stream)
	require.NoError(t, err)
	require.Len(t, stream.responses, 1)
	require.Contains(t, stream.responses[0].Permissions, &authzv1.UserPermission{Action: "dashboards:read", Scope: "dashboards:*"})
	require.NotContains(t, stream.responses[0].Permissions, &authzv1.UserPermission{Action: "dashboards:view", Scope: "dashboards:*"})
}

func TestService_GetUserPermissionsSkipCacheBypassesIdentityCaches(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Editor"},
	}
	service.identityStore = &fakeIdentityStore{userTeams: []int64{7}}
	permissionStore := &snapshotPermissionStore{}
	service.permissionStore = permissionStore

	ctx := t.Context()
	service.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), store.UserIdentifiers{UID: "test-uid", ID: 1})
	service.basicRoleCache.Set(ctx, userBasicRoleCacheKey("org-12", "test-uid"), store.BasicRole{Role: "Viewer"})
	service.userTeamCache.Set(ctx, userTeamCacheKey("org-12", "test-uid"), []int64{1})
	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(ctx, caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
		Options:   &authzv1.GetUserPermissionsOptions{Skipcache: true},
	}, stream)

	require.NoError(t, err)
	require.Equal(t, store.PermissionsQuery{
		UserID:  42,
		TeamIDs: []int64{7},
		Role:    "Editor",
	}, permissionStore.query)
}

func TestService_GetUserPermissionsUsesServerIdentityCachesIndependently(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Editor"},
	}
	service.identityStore = &fakeIdentityStore{userTeams: []int64{7}}
	permissionStore := &snapshotPermissionStore{}
	service.permissionStore = permissionStore

	ctx := t.Context()
	service.idCache.Set(ctx, userIdentifierCacheKey("org-12", "test-uid"), store.UserIdentifiers{UID: "test-uid", ID: 1})
	service.basicRoleCache.Set(ctx, userBasicRoleCacheKey("org-12", "test-uid"), store.BasicRole{Role: "Viewer"})
	service.userTeamCache.Set(ctx, userTeamCacheKey("org-12", "test-uid"), []int64{1})
	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(ctx, caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
	}, stream)

	require.NoError(t, err)
	require.Equal(t, store.PermissionsQuery{
		UserID:  1,
		TeamIDs: []int64{1},
		Role:    "Viewer",
	}, permissionStore.query)
}

func TestService_GetUserPermissionsStreamsLargeSnapshotsInChunks(t *testing.T) {
	service := setupService()
	service.store = &fakeStore{
		userID:    &store.UserIdentifiers{UID: "test-uid", ID: 42},
		basicRole: &store.BasicRole{Role: "Viewer"},
	}
	permissions := make([]accesscontrol.Permission, 1000)
	for i := range permissions {
		permissions[i] = accesscontrol.Permission{Action: "dashboards:read", Scope: fmt.Sprintf("dashboards:uid:%d", i)}
	}
	service.permissionStore = &snapshotPermissionStore{permissions: permissions}
	caller := authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: types.NewTypeID(types.TypeAccessPolicy, "grafana")},
		Rest: authn.AccessTokenClaims{
			Namespace:   "org-12",
			Permissions: []string{"authz.grafana.app/userpermissions:get"},
		},
	})
	stream := &collectUserPermissionsStream{ctx: types.WithAuthInfo(t.Context(), caller)}

	err := service.GetUserPermissions(&authzv1.GetUserPermissionsRequest{
		Namespace: "org-12",
		Subject:   "user:test-uid",
	}, stream)

	require.NoError(t, err)
	require.Len(t, stream.responses, 2)
	require.Len(t, stream.responses[0].Permissions, 1000)
	require.Len(t, stream.responses[1].Permissions, 1)
}

type expandingActionResolver struct{}

func (expandingActionResolver) ExpandActionSets(permissions []accesscontrol.Permission) []accesscontrol.Permission {
	result := make([]accesscontrol.Permission, 0, len(permissions))
	for _, permission := range permissions {
		if permission.Action == "dashboards:view" {
			permission.Action = "dashboards:read"
		}
		result = append(result, permission)
	}
	return result
}

func (expandingActionResolver) ExpandActionSetsWithFilter(permissions []accesscontrol.Permission, _ func(string) bool) []accesscontrol.Permission {
	return permissions
}

func (expandingActionResolver) ResolveAction(string) []string {
	return nil
}

func (expandingActionResolver) ResolveActionPrefix(string) []string {
	return nil
}

type snapshotPermissionStore struct {
	permissions []accesscontrol.Permission
	query       store.PermissionsQuery
}

type recordingUserPermissionsEvaluator struct {
	permissions     []accesscontrol.Permission
	rbacPermissions []accesscontrol.Permission
	user            identity.Requester
	teams           []int64
	options         accesscontrol.Options
}

func (e *recordingUserPermissionsEvaluator) GetRBACUserPermissions(_ context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	e.user = user
	e.teams = user.GetTeams()
	e.options = options
	return e.rbacPermissions, nil
}

func (e *recordingUserPermissionsEvaluator) GetLocalUserPermissions(_ context.Context, user identity.Requester, options accesscontrol.Options) ([]accesscontrol.Permission, error) {
	e.user = user
	e.teams = user.GetTeams()
	e.options = options
	return e.permissions, nil
}

type recordingUserPermissionsResolver struct {
	permissions []accesscontrol.Permission
	user        identity.Requester
	err         error
}

func (r *recordingUserPermissionsResolver) ResolveCurrentUserPermissions(_ context.Context, user identity.Requester) ([]accesscontrol.Permission, error) {
	r.user = user
	return r.permissions, r.err
}

func (s *snapshotPermissionStore) GetUserPermissions(_ context.Context, _ types.NamespaceInfo, query store.PermissionsQuery) ([]accesscontrol.Permission, error) {
	s.query = query
	return s.permissions, nil
}

type collectUserPermissionsStream struct {
	grpc.ServerStream
	ctx       context.Context
	responses []*authzv1.GetUserPermissionsResponse
}

func (s *collectUserPermissionsStream) Context() context.Context {
	return s.ctx
}

func (s *collectUserPermissionsStream) Send(response *authzv1.GetUserPermissionsResponse) error {
	s.responses = append(s.responses, response)
	return nil
}
