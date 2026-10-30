package acimpl

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/legacyscopes"
	"github.com/grafana/grafana/pkg/services/user"
)

type localScopeResolver func(context.Context, types.NamespaceInfo, legacyscopes.ScopeReference) (string, error)

func (f localScopeResolver) ResolveScope(ctx context.Context, ns types.NamespaceInfo, ref legacyscopes.ScopeReference) (string, error) {
	return f(ctx, ns, ref)
}

func TestLocalPermissionLoaderAddsAliasesWithoutZanzanaMerge(t *testing.T) {
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
