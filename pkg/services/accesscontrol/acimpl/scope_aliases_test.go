package acimpl

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
)

type localScopeResolver func(context.Context, types.NamespaceInfo, legacyscopes.ScopeReference) (string, error)

func (f localScopeResolver) ResolveScope(ctx context.Context, ns types.NamespaceInfo, ref legacyscopes.ScopeReference) (string, error) {
	return f(ctx, ns, ref)
}

func TestLocalPermissionLoaderAddsAliasesWithFlagAndNoZanzanaClient(t *testing.T) {
	store := &actest.FakeStore{ExpectedUserPermissions: []accesscontrol.Permission{{Action: "teams:read", Scope: "teams:id:42"}}}
	service := setupServiceWithFakeStore(t, store, nil, nil)
	service.scopeResolver = localScopeResolver(func(context.Context, types.NamespaceInfo, legacyscopes.ScopeReference) (string, error) {
		return "platform", nil
	})
	got, err := service.GetUserPermissions(t.Context(), &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "alice"}, accesscontrol.Options{})
	require.NoError(t, err)
	require.Contains(t, got, accesscontrol.Permission{Action: "teams:read", Scope: "teams:id:42"})
	require.Contains(t, got, accesscontrol.Permission{Action: "teams:read", Scope: "teams:uid:platform"})
}

type aliasFilteringStore struct {
	actest.FakeStore
	t *testing.T
}

func (s *aliasFilteringStore) SearchUsersPermissions(_ context.Context, _ int64, options accesscontrol.SearchOptions) (map[int64][]accesscontrol.Permission, error) {
	require.Equal(s.t, "teams:id:42", options.Scope, "legacy storage must receive the numeric equivalent of the UID filter")
	return map[int64][]accesscontrol.Permission{2: {{Action: "teams:read", Scope: "teams:id:42"}}}, nil
}

func TestPermissionSearchResolvesUIDFilterBeforeLegacyStorage(t *testing.T) {
	store := &aliasFilteringStore{FakeStore: actest.FakeStore{ExpectedUsersRoles: map[int64][]string{2: {"Viewer"}}}, t: t}
	service := setupServiceWithFakeStore(t, store, nil, nil)
	service.roles = map[string]*accesscontrol.RoleDTO{"Viewer": {}}
	service.scopeResolver = localScopeResolver(func(_ context.Context, _ types.NamespaceInfo, ref legacyscopes.ScopeReference) (string, error) {
		if ref.Attribute == "uid" {
			return "42", nil
		}
		return "platform", nil
	})
	got, err := service.SearchUsersPermissions(t.Context(), &user.SignedInUser{OrgID: 1, Namespace: "default"}, accesscontrol.SearchOptions{UserID: 2, Action: "teams:read", Scope: "teams:uid:platform"})
	require.NoError(t, err)
	require.Equal(t, map[int64][]accesscontrol.Permission{2: {{Action: "teams:read", Scope: "teams:uid:platform"}}}, got)
}

func TestLocalPermissionLoaderPreservesScopesWithFlagOff(t *testing.T) {
	original := []accesscontrol.Permission{{Action: "teams:read", Scope: "teams:id:42"}}
	store := &actest.FakeStore{ExpectedUserPermissions: original}
	service := setupServiceWithFakeStore(t, store, nil, nil)
	service.features = featuremgmt.WithFeatures()
	service.scopeResolver = legacypermissions.NewPermissionScopeResolver(service.features, nil)
	got, err := service.GetUserPermissions(t.Context(), &user.SignedInUser{OrgID: 1, UserID: 1, UserUID: "alice"}, accesscontrol.Options{})
	require.NoError(t, err)
	require.Nil(t, service.scopeResolver)
	require.Contains(t, got, original[0])
	require.NotContains(t, got, accesscontrol.Permission{Action: "teams:read", Scope: "teams:uid:platform"})
}

func TestPermissionSearchSeparatesUserIDsAndUIDs(t *testing.T) {
	for _, tc := range []struct {
		name    string
		scopes  []string
		resolve bool
		wantIDs []int64
	}{
		{"ID and numeric UID aliases", []string{"users:id:8", "users:uid:42"}, true, []int64{8}},
		{"UID only", []string{"users:uid:42"}, true, []int64{8}},
		{"unresolved UID", []string{"users:uid:42"}, false, nil},
		{"numeric ID needs no lookup", []string{"users:id:8"}, false, []int64{8}},
		{"user wildcard", []string{"users:*"}, false, []int64{8, 42}},
		{"UID wildcard", []string{"users:uid:*"}, false, []int64{8, 42}},
		{"different resource", []string{"teams:id:42"}, false, nil},
		{"different attribute", []string{"users:name:42"}, false, nil},
		{"partial wildcard", []string{"users:uid:4*"}, true, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			permission := accesscontrol.Permission{Action: "dashboards:read", Scope: "dashboards:uid:one"}
			store := &actest.FakeStore{
				ExpectedUsersRoles:       map[int64][]string{8: {"Viewer"}, 42: {"Viewer"}},
				ExpectedUsersPermissions: map[int64][]accesscontrol.Permission{8: {permission}, 42: {permission}},
			}
			service := setupServiceWithFakeStore(t, store, nil, nil)
			service.roles = map[string]*accesscontrol.RoleDTO{"Viewer": {}}
			service.scopeResolver = nil
			if tc.resolve {
				service.scopeResolver = localScopeResolver(func(_ context.Context, _ types.NamespaceInfo, ref legacyscopes.ScopeReference) (string, error) {
					require.Equal(t, "users", ref.Resource)
					require.Equal(t, "uid", ref.Attribute)
					if ref.Value == "42" {
						return "8", nil
					}
					return "", nil
				})
			}
			requester := &user.SignedInUser{OrgID: 1, Namespace: "default", Permissions: map[int64]map[string][]string{
				1: {accesscontrol.ActionUsersPermissionsRead: tc.scopes},
			}}
			got, err := service.SearchUsersPermissions(t.Context(), requester, accesscontrol.SearchOptions{Action: permission.Action})
			require.NoError(t, err)
			require.Len(t, got, len(tc.wantIDs))
			for _, id := range tc.wantIDs {
				require.Equal(t, []accesscontrol.Permission{permission}, got[id])
			}
		})
	}
}
