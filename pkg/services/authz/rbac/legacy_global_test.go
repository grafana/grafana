package rbac

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
	"github.com/grafana/grafana/pkg/services/folder"
)

func TestLegacyCheckGlobalEvaluation(t *testing.T) {
	for _, tc := range []struct {
		name             string
		evaluator        accesscontrol.Evaluator
		permittedActions []string
		globalGrants     []accesscontrol.Permission
		want             *authzextv1.LegacyCheckResponse
	}{
		{
			name:             "global direct grant",
			evaluator:        accesscontrol.EvalPermission("users:read", "users:id:7"),
			permittedActions: []string{"users:read"},
			globalGrants:     []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			want:             &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:             "organization grant is excluded",
			evaluator:        accesscontrol.EvalPermission("users:read", "users:id:7"),
			permittedActions: []string{"users:read"},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:             "caller presence alone does not grant requested action",
			evaluator:        accesscontrol.EvalPermission("users:delete", "users:id:7"),
			permittedActions: []string{"users:read"},
			globalGrants:     []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:         "empty global map denies empty all even with stored grants",
			evaluator:    accesscontrol.EvalAll(),
			globalGrants: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			want:         &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:         "empty global map denies a stored matching grant",
			evaluator:    accesscontrol.EvalPermission("users:read", "users:id:7"),
			globalGrants: []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			want:         &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:             "nonempty global map allows empty all",
			evaluator:        accesscontrol.EvalAll(),
			permittedActions: []string{"users:read"},
			want:             &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:             "empty any denies",
			evaluator:        accesscontrol.EvalAny(),
			permittedActions: []string{"users:read"},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:             "global loader includes shared with me",
			evaluator:        accesscontrol.EvalPermission("folders:read", "folders:uid:sharedwithme"),
			permittedActions: []string{"folders:read"},
			want:             &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:             "global action set",
			evaluator:        accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:one"),
			permittedActions: []string{"dashboards:read"},
			globalGrants:     []accesscontrol.Permission{{Action: "dashboards:view", Scope: "dashboards:uid:one"}},
			want:             &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:             "restricted action is not restored from stored grants",
			evaluator:        accesscontrol.EvalPermission("users:read", "users:id:7"),
			permittedActions: []string{"folders:read"},
			globalGrants:     []accesscontrol.Permission{{Action: "users:read", Scope: "users:*"}},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:             "permitted action still requires matching stored scope",
			evaluator:        accesscontrol.EvalPermission("users:read", "users:id:7"),
			permittedActions: []string{"users:read"},
			globalGrants:     []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:8"}},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:             "restricted action is not restored by action set",
			evaluator:        accesscontrol.EvalPermission("dashboards:read", "dashboards:uid:one"),
			permittedActions: []string{"users:read"},
			globalGrants:     []accesscontrol.Permission{{Action: "dashboards:view", Scope: "dashboards:uid:one"}},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
		{
			name:             "shared with me does not restore restricted folders read",
			evaluator:        accesscontrol.EvalPermission("folders:read", "folders:uid:sharedwithme"),
			permittedActions: []string{"users:read"},
			want:             &authzextv1.LegacyCheckResponse{Allowed: false},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, orgID := range []int64{accesscontrol.NoOrgID, accesscontrol.GlobalOrgID} {
				for _, identityType := range []types.IdentityType{types.TypeUser, types.TypeServiceAccount} {
					t.Run(fmt.Sprintf("org=%d/%s", orgID, identityType), func(t *testing.T) {
						s, permissions := newLegacyGlobalTestService(tc.globalGrants)
						expression, err := accesscontrol.ToLegacyExpression(tc.evaluator)
						require.NoError(t, err)
						req := &authzextv1.LegacyCheckRequest{
							Restriction: &authzextv1.LegacyActionRestriction{Actions: tc.permittedActions},
							Namespace:   "org-12",
							Subject:     types.NewTypeID(identityType, "checked-user"),
							Expression:  expression,
							GlobalEvaluation: &authzextv1.LegacyGlobalEvaluation{
								RequesterOrgId: orgID,
							},
						}

						got, err := s.LegacyCheck(legacyCheckContext(t), req)

						require.NoError(t, err)
						require.True(t, proto.Equal(tc.want, got), "want %v, got %v", tc.want, got)
						require.Empty(t, permissions.presenceQueries)
						require.Zero(t, s.identityStore.(*fakeIdentityStore).calls)
						if len(tc.permittedActions) == 0 {
							require.Empty(t, permissions.queries)
							require.Zero(t, s.store.(*fakeStore).calls)
						}
						for _, query := range permissions.queries {
							require.NotEmpty(t, query.Action)
							require.Contains(t, tc.permittedActions, query.Action)
							require.Equal(t, "None", query.Role)
							require.Empty(t, query.TeamIDs)
						}
					})
				}
			}
		})
	}
}

func TestLegacyCheckGlobalValidation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*Service, *authzextv1.LegacyCheckRequest)
		error  string
	}{
		{
			name: "organization is not global requester state",
			mutate: func(_ *Service, req *authzextv1.LegacyCheckRequest) {
				req.GlobalEvaluation.RequesterOrgId = 12
			},
			error: "global evaluation requires requester org 0 or NoOrgID",
		},
		{
			name: "standalone has no instance-global provider",
			mutate: func(s *Service, _ *authzextv1.LegacyCheckRequest) {
				s.legacyScopeResolvers = nil
				s.legacyScopeNamespace = nil
			},
			error: "global evaluation requires a namespace belonging to the embedded instance",
		},
		{
			name: "other namespace is denied",
			mutate: func(_ *Service, req *authzextv1.LegacyCheckRequest) {
				req.Namespace = "org-13"
			},
			error: "namespace does not match",
		},
		{
			name: "anonymous has no global identity",
			mutate: func(_ *Service, req *authzextv1.LegacyCheckRequest) {
				req.Subject = "anonymous:0"
			},
			error: "global evaluation requires a user or service account",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, permissions := newLegacyGlobalTestService(nil)
			req := legacyPermissionRequest("user:checked-user", "users:read")
			req.GlobalEvaluation = &authzextv1.LegacyGlobalEvaluation{RequesterOrgId: accesscontrol.NoOrgID}
			req.Restriction = &authzextv1.LegacyActionRestriction{Actions: []string{"users:read"}}
			tc.mutate(s, req)

			got, err := s.LegacyCheck(legacyCheckContext(t), req)

			require.NoError(t, err)
			require.False(t, got.GetAllowed())
			require.ErrorContains(t, errors.New(got.GetError()), tc.error)
			require.Empty(t, permissions.queries)
			require.Zero(t, s.store.(*fakeStore).calls)
		})
	}
}

func TestLegacyCheckGlobalResolverContext(t *testing.T) {
	for _, orgID := range []int64{accesscontrol.NoOrgID, accesscontrol.GlobalOrgID} {
		t.Run(fmt.Sprintf("org=%d", orgID), func(t *testing.T) {
			grants := []accesscontrol.Permission{{Action: "users:read", Scope: "users:id:7"}}
			s, permissions := newLegacyGlobalTestService(grants)
			folders := &failingLegacyFolderPermissions{PermissionStore: permissions.PermissionStore}
			permissions.PermissionStore = folders
			ac := acimpl.ProvideAccessControlTest()
			calls := 0
			ac.RegisterScopeAttributeResolver("users:login:", accesscontrol.ScopeAttributeResolverFunc(
				func(ctx context.Context, gotOrgID int64, _ string) ([]string, error) {
					calls++
					require.Equal(t, orgID, gotOrgID)
					requester, err := identity.GetRequester(ctx)
					require.NoError(t, err)
					require.Equal(t, orgID, requester.GetOrgID())
					require.Equal(t, "user:checked-user", requester.GetUID())
					require.Equal(t, "org-12", requester.GetNamespace())
					allowed, err := ac.WithoutResolvers().Evaluate(ctx, requester, accesscontrol.EvalPermission("users:read", "users:id:7"))
					require.NoError(t, err)
					require.True(t, allowed)
					return []string{"users:id:7"}, nil
				},
			))
			s = s.WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			req := legacyPermissionRequest("user:checked-user", "users:read", "users:login:alice")
			req.GlobalEvaluation = &authzextv1.LegacyGlobalEvaluation{RequesterOrgId: orgID}
			req.Restriction = &authzextv1.LegacyActionRestriction{Actions: []string{"users:read", folder.ActionFoldersRead}}

			got, err := s.LegacyCheck(legacyCheckContext(t), req)

			require.NoError(t, err)
			require.True(t, proto.Equal(&authzextv1.LegacyCheckResponse{Allowed: true}, got), "got %v", got)
			require.Equal(t, 1, calls)
			require.Zero(t, folders.folderQueries)
		})
	}
}

func TestLegacyCheckGlobalFailureDenies(t *testing.T) {
	for _, tc := range []struct {
		name string
		fail func(*Service, *legacyGlobalPermissionStore)
	}{
		{
			name: "identity or admin lookup fails",
			fail: func(s *Service, _ *legacyGlobalPermissionStore) { s.store.(*fakeStore).err = true },
		},
		{
			name: "permission lookup fails",
			fail: func(_ *Service, permissions *legacyGlobalPermissionStore) {
				permissions.err = errors.New("global permissions unavailable")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, permissions := newLegacyGlobalTestService(nil)
			tc.fail(s, permissions)
			req := legacyPermissionRequest("user:checked-user", "folders:read", "folders:uid:sharedwithme")
			req.GlobalEvaluation = &authzextv1.LegacyGlobalEvaluation{RequesterOrgId: accesscontrol.NoOrgID}
			req.Restriction = &authzextv1.LegacyActionRestriction{Actions: []string{"folders:read"}}

			got, err := s.LegacyCheck(legacyCheckContext(t), req)

			require.NoError(t, err)
			require.False(t, got.GetAllowed())
			require.NotEmpty(t, got.GetError())
		})
	}
}

func TestLegacyCheckGlobalResolverRestrictedPermissions(t *testing.T) {
	for _, tc := range []struct {
		name             string
		permittedActions []string
		folderCheck      accesscontrol.Evaluator
		want             *authzextv1.LegacyCheckResponse
	}{
		{
			name:             "permitted folder lookup",
			permittedActions: []string{"users:read", "folders:read"},
			folderCheck:      accesscontrol.EvalPermission("folders:read", "folders:uid:parent"),
			want:             &authzextv1.LegacyCheckResponse{Allowed: true},
		},
		{
			name:             "restricted folder lookup",
			permittedActions: []string{"users:read"},
			folderCheck:      accesscontrol.EvalPermission("folders:read", "folders:uid:parent"),
			want: &authzextv1.LegacyCheckResponse{
				Allowed: false,
				Error:   "could not evaluate legacy expression: could not resolve users:login:alice: folder visibility denied",
			},
		},
		{
			name:             "restricted action-only folder lookup",
			permittedActions: []string{"users:read"},
			folderCheck:      accesscontrol.EvalPermission("folders:read"),
			want: &authzextv1.LegacyCheckResponse{
				Allowed: false,
				Error:   "could not evaluate legacy expression: could not resolve users:login:alice: folder visibility denied",
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s, permissions := newLegacyGlobalTestService([]accesscontrol.Permission{
				{Action: "users:read", Scope: "users:id:7"},
				{Action: "folders:read", Scope: "folders:uid:parent"},
			})
			ac := acimpl.ProvideAccessControlTest()
			calls := 0
			ac.RegisterScopeAttributeResolver("users:login:", accesscontrol.WithRequiredActions(accesscontrol.ScopeAttributeResolverFunc(
				func(ctx context.Context, _ int64, _ string) ([]string, error) {
					calls++
					requester, err := identity.GetRequester(ctx)
					if err != nil {
						return nil, err
					}

					allowed, err := ac.WithoutResolvers().Evaluate(ctx, requester, tc.folderCheck)
					if err != nil {
						return nil, err
					}
					if !allowed {
						return nil, errors.New("folder visibility denied")
					}

					return []string{"users:id:7"}, nil
				},
			), folder.ActionFoldersRead))
			s = s.WithLegacyScopeResolvers(acimpl.ProvideScopeResolverRegistry(ac), types.OrgNamespaceFormatter)
			req := legacyPermissionRequest("user:checked-user", "users:read", "users:login:alice")
			req.GlobalEvaluation = &authzextv1.LegacyGlobalEvaluation{RequesterOrgId: accesscontrol.NoOrgID}
			req.Restriction = &authzextv1.LegacyActionRestriction{Actions: tc.permittedActions}

			got, err := s.LegacyCheck(legacyCheckContext(t), req)

			require.NoError(t, err)
			require.True(t, proto.Equal(tc.want, got), "got %v", got)
			require.Equal(t, 1, calls)
			for _, query := range permissions.queries {
				require.Contains(t, tc.permittedActions, query.Action)
			}
		})
	}
}

func newLegacyGlobalTestService(grants []accesscontrol.Permission) (*Service, *legacyGlobalPermissionStore) {
	s := NewTestService("checked-user", grants, nil)
	s.store.(*fakeStore).basicRole = &store.BasicRole{Role: "Viewer", IsAdmin: false}
	s = s.WithLegacyScopeResolvers(accesscontrol.NewScopeResolverRegistry(), types.OrgNamespaceFormatter)
	s.actionResolver = legacyActionResolver{}
	permissions := &legacyGlobalPermissionStore{
		legacyPermissionStore: legacyPermissionStore{PermissionStore: s.permissionStore},
	}
	s.permissionStore = permissions
	s.userPermissionsEvaluator = permissions
	return s, permissions
}

type legacyGlobalPermissionStore struct {
	legacyPermissionStore
}

func (s *legacyGlobalPermissionStore) GetLocalUserPermissions(
	context.Context,
	identity.Requester,
	accesscontrol.Options,
) ([]accesscontrol.Permission, error) {
	return nil, errors.New("full permission loading must not be called")
}

func (s *legacyGlobalPermissionStore) GetGlobalUserPermissions(
	ctx context.Context,
	requester identity.Requester,
	actions []string,
) (map[string][]string, error) {
	if requester.GetOrgID() != accesscontrol.GlobalOrgID || requester.GetOrgRole() != identity.RoleNone {
		return nil, errors.New("global loader received organization state")
	}
	permissions := make(map[string][]string)
	userID, err := requester.GetInternalID()
	if err != nil {
		return nil, err
	}
	for _, action := range actions {
		grants, err := s.GetUserPermissions(ctx, types.NamespaceInfo{Value: requester.GetNamespace(), OrgID: 0}, store.PermissionsQuery{
			UserID:     userID,
			Role:       "None",
			Action:     action,
			ActionSets: legacyActionResolver{}.ResolveAction(action),
		})
		if err != nil {
			return nil, err
		}
		for _, grant := range grants {
			permissions[action] = append(permissions[action], grant.Scope)
		}
		if action == folder.ActionFoldersRead {
			permissions[action] = append(permissions[action], "folders:uid:sharedwithme")
		}
	}
	return permissions, nil
}

func (s *legacyGlobalPermissionStore) GetUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query store.PermissionsQuery,
) ([]accesscontrol.Permission, error) {
	if ns.OrgID != accesscontrol.GlobalOrgID || ns.Value != "org-12" {
		return nil, errors.New("global query changed tenant or used organization grants")
	}
	if namespace, ok := request.NamespaceFrom(ctx); !ok || namespace != "org-12" {
		return nil, errors.New("global query changed the database routing namespace")
	}
	return s.legacyPermissionStore.GetUserPermissions(ctx, ns, query)
}
