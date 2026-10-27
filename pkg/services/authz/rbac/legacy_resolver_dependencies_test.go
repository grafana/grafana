package rbac

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/folder"
)

func TestLegacyResolverRequiredPermissionFailureDenies(t *testing.T) {
	ac := acimpl.ProvideAccessControlTest()
	calls := 0
	ac.RegisterScopeAttributeResolver("library.panels:uid:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
		func(context.Context, int64, string) ([]string, error) {
			calls++
			return []string{"folders:uid:parent"}, nil
		},
	), folder.ActionFoldersRead))
	s := NewTestService("u-1", []accesscontrol.Permission{
		{Action: "library.panels:read", Scope: "folders:uid:parent"},
	}, nil).WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	permissions := &failingLegacyFolderPermissions{PermissionStore: s.permissionStore}
	s.permissionStore = permissions

	got, err := s.LegacyCheck(legacyCheckContext(t), legacyPermissionRequest("user:u-1", "library.panels:read", "library.panels:uid:one"))

	require.NoError(t, err)
	require.False(t, got.GetAllowed())
	require.Contains(t, got.GetError(), "folder permissions unavailable")
	require.Zero(t, calls)
	require.Equal(t, 1, permissions.folderQueries)
}

func TestLegacyResolverLoadsDependenciesAfterFirstResolver(t *testing.T) {
	for _, combine := range []struct {
		name       string
		expression func(...*authzextv1.LegacyExpression) *authzextv1.LegacyExpression
	}{
		{name: "ALL", expression: legacyAllExpression},
		{name: "ANY", expression: legacyAnyExpression},
	} {
		for _, folderVisible := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/folderVisible=%t", combine.name, folderVisible), func(t *testing.T) {
				grants := []accesscontrol.Permission{
					{Action: "datasources:query", Scope: "datasources:uid:one"},
					{Action: "library.panels:read", Scope: "folders:uid:parent"},
				}
				if folderVisible {
					grants = append(grants, accesscontrol.Permission{Action: folder.ActionFoldersRead, Scope: "folders:uid:parent"})
				}
				s := NewTestService("u-1", grants, nil)
				permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
				s.permissionStore = permissions
				ac := acimpl.ProvideAccessControlTest()
				var resolved []string
				ac.RegisterScopeAttributeResolver("datasources:name:", accesscontrol.ScopeAttributeResolverFunc(
					func(ctx context.Context, _ int64, scope string) ([]string, error) {
						resolved = append(resolved, scope)
						requester, err := identity.GetRequester(ctx)
						require.NoError(t, err)
						require.NotContains(t, requester.GetPermissions(), folder.ActionFoldersRead)
						return []string{"datasources:uid:one"}, nil
					},
				))
				ac.RegisterScopeAttributeResolver("library.panels:uid:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
					func(ctx context.Context, _ int64, scope string) ([]string, error) {
						resolved = append(resolved, scope)
						requester, err := identity.GetRequester(ctx)
						require.NoError(t, err)
						require.Equal(t, folderVisible, accesscontrol.EvalPermission(folder.ActionFoldersRead).Evaluate(requester.GetPermissions()))
						return []string{"folders:uid:parent"}, nil
					},
				), folder.ActionFoldersRead, folder.ActionFoldersRead, "datasources:query"))
				s = s.WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
				req := legacyPermissionRequest("user:u-1", "datasources:query")
				req.Expression = combine.expression(
					legacyPermissionExpression("datasources:query", "datasources:name:one"),
					legacyPermissionExpression("library.panels:read", "library.panels:uid:one", "library.panels:uid:two"),
				)

				for range 2 {
					resolved = nil
					permissions.queries = nil
					got, err := s.LegacyCheck(legacyCheckContext(t), req)
					require.NoError(t, err)
					require.True(t, got.GetAllowed())
					require.Empty(t, got.GetError())
					require.Equal(t, []string{"datasources:name:one", "library.panels:uid:one", "library.panels:uid:two"}, resolved)
					actions := make([]string, 0, len(permissions.queries))
					for _, query := range permissions.queries {
						actions = append(actions, query.Action)
					}
					require.ElementsMatch(t, []string{"datasources:query", "library.panels:read", folder.ActionFoldersRead}, actions)
				}
			})
		}
	}
}

func TestLegacyResolverDependenciesDoNotChangeEvaluationPermissions(t *testing.T) {
	permissions := map[string][]string{"library.panels:read": {"folders:uid:parent"}}
	s := NewTestService("u-1", []accesscontrol.Permission{
		{Action: folder.ActionFoldersRead, Scope: "folders:uid:parent"},
	}, nil)
	ac := acimpl.ProvideAccessControlTest()
	ac.RegisterScopeAttributeResolver("library.panels:uid:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
		func(ctx context.Context, _ int64, _ string) ([]string, error) {
			requester, err := identity.GetRequester(ctx)
			require.NoError(t, err)
			require.Equal(t, []string{"folders:uid:parent"}, requester.GetPermissions()[folder.ActionFoldersRead])
			return []string{"folders:uid:parent"}, nil
		},
	), folder.ActionFoldersRead))
	s = s.WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
	ctx := request.WithNamespace(legacyCheckContext(t), "org-12")
	allowed, err := s.evaluateLegacyWithResolvers(ctx, accesscontrol.EvalAll(
		accesscontrol.EvalPermission("library.panels:read", "library.panels:uid:one"),
		accesscontrol.EvalPermission(folder.ActionFoldersRead),
	), permissions, true, false, legacyScopeRequest{
		namespace: types.NamespaceInfo{Value: "org-12", OrgID: 12}, identityType: types.TypeUser, userUID: "u-1",
	})
	require.NoError(t, err)
	require.False(t, allowed)
	require.Equal(t, map[string][]string{"library.panels:read": {"folders:uid:parent"}}, permissions)
}
