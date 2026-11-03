package rbac

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing/licensingtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestService_LegacyCheckSharedWithMe(t *testing.T) {
	sharedWithMe := acimpl.SharedWithMeFolderPermission

	for _, tc := range []struct {
		name       string
		expression *authzextv1.LegacyExpression
		allowed    bool
	}{
		{
			name:       "read the virtual folder",
			expression: legacyPermissionExpression(sharedWithMe.Action, sharedWithMe.Scope),
			allowed:    true,
		},
		{
			name:       "action only read",
			expression: legacyPermissionExpression(sharedWithMe.Action),
			allowed:    true,
		},
		{
			name:       "explicit empty scope is not granted",
			expression: legacyPermissionExpression(sharedWithMe.Action, ""),
			allowed:    false,
		},
		{
			name:       "another folder is not granted",
			expression: legacyPermissionExpression(sharedWithMe.Action, "folders:uid:private"),
			allowed:    false,
		},
		{
			name:       "all folders are not granted",
			expression: legacyPermissionExpression(sharedWithMe.Action, "folders:*"),
			allowed:    false,
		},
		{
			name:       "write is not granted",
			expression: legacyPermissionExpression(folder.ActionFoldersWrite, sharedWithMe.Scope),
			allowed:    false,
		},
		{
			name:       "dashboard access is not granted",
			expression: legacyPermissionExpression("dashboards:read", sharedWithMe.Scope),
			allowed:    false,
		},
		{
			name: "any can use the virtual folder grant",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:private"),
				legacyPermissionExpression(sharedWithMe.Action, sharedWithMe.Scope),
			),
			allowed: true,
		},
		{
			name: "all still requires the other permission",
			expression: legacyAllExpression(
				legacyPermissionExpression(sharedWithMe.Action, sharedWithMe.Scope),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:private"),
			),
			allowed: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, subject := range []string{"user:u-1", "service-account:u-1", "anonymous:0"} {
				t.Run(subject, func(t *testing.T) {
					s := NewTestService("u-1", nil, nil)
					permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
					s.permissionStore = permissions

					got, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
						Namespace:  "org-12",
						Subject:    subject,
						Expression: tc.expression,
					})
					require.NoError(t, err)

					want := &authzextv1.LegacyCheckResponse{Allowed: tc.allowed}
					require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
					require.Empty(t, permissions.presenceQueries)

					for _, query := range permissions.queries {
						require.NotEmpty(t, query.Action)
					}
				})
			}
		})
	}
}

func TestLegacyCheckResolverUsesSharedWithMe(t *testing.T) {
	sharedWithMe := acimpl.SharedWithMeFolderPermission

	for _, subject := range []string{"user:u-1", "service-account:u-1", "anonymous:0"} {
		t.Run(subject, func(t *testing.T) {
			ac := acimpl.ProvideAccessControlTest()
			calls := 0
			ac.RegisterScopeAttributeResolver("folders:uid:", accesscontrol.ScopeAttributeResolverFunc(
				func(ctx context.Context, orgID int64, scope string) ([]string, error) {
					calls++

					requester, err := identity.GetRequester(ctx)
					require.NoError(t, err)
					require.Equal(t, subject, requester.GetUID())
					require.Equal(t, map[string][]string{
						sharedWithMe.Action: {sharedWithMe.Scope},
					}, requester.GetPermissions())

					allowed, err := ac.WithoutResolvers().Evaluate(ctx, requester,
						accesscontrol.EvalPermission(sharedWithMe.Action, sharedWithMe.Scope))
					require.NoError(t, err)
					require.True(t, allowed)

					return []string{sharedWithMe.Scope}, nil
				},
			))
			s := NewTestService("u-1", nil, nil).
				WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)

			got, err := s.LegacyCheck(legacyCheckContext(t),
				legacyPermissionRequest(subject, sharedWithMe.Action, "folders:uid:alias"))
			require.NoError(t, err)

			want := &authzextv1.LegacyCheckResponse{Allowed: true}
			require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
			require.Equal(t, 1, calls)
		})
	}
}

func TestIntegrationLegacyCheckSharedWithMeParity(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	database := db.NewTestStore(t)
	sharedWithMe := acimpl.SharedWithMeFolderPermission

	for _, mode := range []struct {
		name        string
		enforcement bool
		cache       bool
	}{
		{name: "OSS uncached", enforcement: false, cache: false},
		{name: "OSS cached", enforcement: false, cache: true},
		{name: "Enterprise uncached", enforcement: true, cache: false},
		{name: "Enterprise cached", enforcement: true, cache: true},
	} {
		t.Run(mode.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.RBAC.PermissionCache = mode.cache
			license := licensingtest.NewFakeLicensing()
			license.On("FeatureEnabled", "accesscontrol.enforcement").Return(mode.enforcement)
			loader := legacypermissions.NewLoader(
				database,
				legacypermissions.NewRoleCatalog(),
				resourcepermissions.NewActionSetService(),
				localcache.New(0, 0),
				cfg,
				featuremgmt.WithFeatures(),
				license,
				nil,
			)

			for _, ident := range []struct {
				kind types.IdentityType
				id   int64
				uid  string
			}{
				{kind: types.TypeUser, id: 1, uid: "u-1"},
				{kind: types.TypeServiceAccount, id: 1, uid: "u-1"},
				{kind: types.TypeAnonymous, id: 0, uid: "0"},
			} {
				t.Run(string(ident.kind), func(t *testing.T) {
					requester := &identity.StaticRequester{
						Type:      ident.kind,
						UserID:    ident.id,
						UserUID:   ident.uid,
						OrgID:     12,
						OrgRole:   identity.RoleViewer,
						Namespace: "org-12",
						CacheKey:  types.NewTypeID(ident.kind, ident.uid),
					}
					grants, err := loader.GetUserPermissions(t.Context(), requester, accesscontrol.Options{})
					require.NoError(t, err)
					require.Equal(t, []accesscontrol.Permission{sharedWithMe}, grants)

					requester.Permissions = map[int64]map[string][]string{
						12: accesscontrol.GroupScopesByActionContext(t.Context(), grants),
					}
					ac := acimpl.ProvideAccessControlTest()
					s := NewTestService("u-1", nil, nil)

					for _, tc := range []struct {
						name      string
						evaluator accesscontrol.Evaluator
						allowed   bool
					}{
						{
							name:      "empty all",
							evaluator: accesscontrol.EvalAll(),
							allowed:   true,
						},
						{
							name:      "empty any",
							evaluator: accesscontrol.EvalAny(),
							allowed:   false,
						},
						{
							name:      "shared with me",
							evaluator: accesscontrol.EvalPermission(sharedWithMe.Action, sharedWithMe.Scope),
							allowed:   true,
						},
						{
							name:      "other folder",
							evaluator: accesscontrol.EvalPermission(sharedWithMe.Action, "folders:uid:private"),
							allowed:   false,
						},
						{
							name:      "dashboard",
							evaluator: accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:private"),
							allowed:   false,
						},
					} {
						t.Run(tc.name, func(t *testing.T) {
							allowed, err := ac.Evaluate(t.Context(), requester, tc.evaluator)
							require.NoError(t, err)
							require.Equal(t, tc.allowed, allowed)

							expression, err := accesscontrol.ToLegacyExpression(tc.evaluator)
							require.NoError(t, err)

							got, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
								Namespace:  requester.Namespace,
								Subject:    requester.GetUID(),
								Expression: expression,
							})
							require.NoError(t, err)

							want := &authzextv1.LegacyCheckResponse{Allowed: allowed}
							require.True(t, proto.Equal(want, got), "want %v, got %v", want, got)
						})
					}
				})
			}
		})
	}
}
