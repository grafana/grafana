package rbac

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestService_LegacyCheckComposites(t *testing.T) {
	for _, tc := range []struct {
		name        string
		expression  *authzextv1.LegacyExpression
		permissions []accesscontrol.Permission
		allowed     bool
	}{
		{
			name: "all requires both actions",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "dashboards:uid:dash-1",
				},
				{
					Action: "folders:read",
					Scope:  "folders:uid:folder-1",
				},
			},
			allowed: true,
		},
		{
			name: "all denies a missing action",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
				},
			},
			allowed: false,
		},
		{
			name: "all denies a scope mismatch",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
				},
				{
					Action: "folders:read",
					Scope:  "folders:uid:folder-2",
				},
			},
			allowed: false,
		},
		{
			name: "any allows the first matching action",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
				},
			},
			allowed: true,
		},
		{
			name: "any allows a later matching action",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "folders:read",
					Scope:  "folders:*",
				},
			},
			allowed: true,
		},
		{
			name: "any denies without a matching action",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read"),
				legacyPermissionExpression("folders:read"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
				},
			},
			allowed: false,
		},
		{
			name: "nested all and any with action sets and alternative scopes",
			expression: legacyAllExpression(
				legacyAnyExpression(
					legacyPermissionExpression("dashboards:write", "dashboards:uid:dash-1"),
					legacyPermissionExpression(
						"dashboards:read",
						"dashboards:uid:missing",
						"dashboards:uid:dash-1",
					),
				),
				legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:view",
					Scope:  "dashboards:uid:dash-1",
				},
				{
					Action: "folders:read",
					Scope:  "folders:*",
				},
			},
			allowed: true,
		},
		{
			name: "repeated action keeps separate required scopes",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-2"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "dashboards:uid:dash-1",
				},
			},
			allowed: false,
		},
		{
			name: "action only accepts an empty granted scope",
			expression: legacyAllExpression(
				legacyPermissionExpression("users:create"),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
				},
				{
					Action: "dashboards:read",
					Scope:  "*",
				},
			},
			allowed: true,
		},
		{
			name: "explicit empty scope still denies",
			expression: legacyAllExpression(
				legacyPermissionExpression("users:create", ""),
				legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
			),
			permissions: []accesscontrol.Permission{
				{
					Action: "users:create",
				},
				{
					Action: "dashboards:read",
					Scope:  "*",
				},
			},
			allowed: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, subject := range []string{"user:u-1", "service-account:u-1", "anonymous:0"} {
				t.Run(subject, func(t *testing.T) {
					s := NewTestService("u-1", tc.permissions, nil)
					s.actionResolver = legacyActionResolver{}

					localEvaluator := &recordingUserPermissionsEvaluator{}
					s.userPermissionsEvaluator = localEvaluator

					response, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
						Namespace:  "org-12",
						Subject:    subject,
						Expression: tc.expression,
					})

					require.NoError(t, err)
					require.Empty(t, response.GetError())

					require.Equal(t, tc.allowed, response.GetAllowed())
					require.Nil(t, localEvaluator.user)
				})
			}
		})
	}
}

func TestService_LegacyCheckEmptyComposites(t *testing.T) {
	for _, tc := range []struct {
		name                   string
		expression             *authzextv1.LegacyExpression
		allowedWithPermissions bool
	}{
		{
			name:                   "empty all",
			expression:             legacyAllExpression(),
			allowedWithPermissions: true,
		},
		{
			name:                   "empty any",
			expression:             legacyAnyExpression(),
			allowedWithPermissions: false,
		},
		{
			name: "nested empty all",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read"),
				legacyAllExpression(),
			),
			allowedWithPermissions: true,
		},
		{
			name: "nested empty any",
			expression: legacyAllExpression(
				legacyPermissionExpression("dashboards:read"),
				legacyAnyExpression(),
			),
			allowedWithPermissions: false,
		},
		{
			name: "empty all does not replace a required permission",
			expression: legacyAllExpression(
				legacyPermissionExpression("users:delete"),
				legacyAllExpression(),
			),
			allowedWithPermissions: false,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, subject := range []string{"user:u-1", "service-account:u-1", "anonymous:0", "render:0"} {
				t.Run(subject, func(t *testing.T) {
					for _, grants := range []struct {
						name        string
						permissions []accesscontrol.Permission
					}{
						{
							name: "no stored grants",
						},
						{
							name: "unrelated grant with empty scope",
							permissions: []accesscontrol.Permission{
								{
									Action: "users:create",
								},
							},
						},
						{
							name: "requested grant",
							permissions: []accesscontrol.Permission{
								{
									Action: "dashboards:read",
									Scope:  "*",
								},
							},
						},
					} {
						t.Run(grants.name, func(t *testing.T) {
							s := NewTestService("u-1", grants.permissions, nil)

							permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
							s.permissionStore = permissions

							localEvaluator := &recordingUserPermissionsEvaluator{}
							s.userPermissionsEvaluator = localEvaluator

							response, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
								Namespace:  "org-12",
								Subject:    subject,
								Expression: tc.expression,
							})

							require.NoError(t, err)
							require.Empty(t, response.GetError())

							hasAnyPermissions := subject == "render:0" || len(grants.permissions) > 0
							require.Equal(t, hasAnyPermissions && tc.allowedWithPermissions, response.GetAllowed())
							require.Nil(t, localEvaluator.user)

							if subject == "render:0" {
								require.Empty(t, permissions.queries)
								require.Empty(t, permissions.presenceQueries)
							}
						})
					}
				})
			}
		})
	}
}

func TestService_LegacyCheckCompositeQueries(t *testing.T) {
	s := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "dashboards:view",
			Scope:  "dashboards:*",
		},
		{
			Action: "folders:read",
			Scope:  "folders:*",
		},
	}, nil)
	s.actionResolver = legacyActionResolver{}

	f := s.store.(*fakeStore)
	f.basicRole = &store.BasicRole{
		Role:    "Editor",
		IsAdmin: true,
	}

	identityStore := s.identityStore.(*fakeIdentityStore)
	identityStore.userTeams = []int64{10}

	permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
	s.permissionStore = permissions

	response, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
		Namespace: "org-12",
		Subject:   "user:u-1",
		SkipCache: true,
		Expression: legacyAllExpression(
			legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-1"),
			legacyPermissionExpression("folders:read", "folders:uid:folder-1"),
			legacyPermissionExpression("dashboards:read", "dashboards:uid:dash-2"),
			legacyAnyExpression(legacyAllExpression()),
		),
	})

	require.NoError(t, err)
	require.Empty(t, response.GetError())

	require.True(t, response.GetAllowed())

	require.Equal(t, []store.PermissionsQuery{
		{
			UserID:        1,
			Action:        "dashboards:read",
			ActionSets:    []string{"dashboards:view", "dashboards:edit"},
			TeamIDs:       []int64{10},
			Role:          "Editor",
			IsServerAdmin: true,
		},
		{
			UserID:        1,
			Action:        "folders:read",
			TeamIDs:       []int64{10},
			Role:          "Editor",
			IsServerAdmin: true,
		},
	}, permissions.queries)

	require.Empty(t, permissions.presenceQueries)

	// Even with cache bypass, identifiers, basic role and teams are fetched once.
	require.Equal(t, 4, f.calls)
	require.Equal(t, 1, identityStore.calls)
}

func TestService_LegacyCheckUnrelatedPermissionQuery(t *testing.T) {
	s := NewTestService("u-1", []accesscontrol.Permission{
		{
			Action: "users:create",
		},
	}, nil)
	s.actionResolver = legacyActionResolver{}
	s.store.(*fakeStore).basicRole = &store.BasicRole{Role: "Viewer"}
	s.identityStore.(*fakeIdentityStore).userTeams = []int64{10}

	permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
	s.permissionStore = permissions

	response, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
		Namespace: "org-12",
		Subject:   "user:u-1",
		Expression: legacyAnyExpression(
			legacyPermissionExpression("dashboards:read"),
			legacyAllExpression(),
		),
	})

	require.NoError(t, err)
	require.Empty(t, response.GetError())

	require.True(t, response.GetAllowed())

	require.Equal(t, []store.PermissionsQuery{
		{
			UserID:        1,
			TeamIDs:       []int64{10},
			Role:          "Viewer",
			IsServerAdmin: false,
			Action:        "dashboards:read",
			ActionSets:    []string{"dashboards:view", "dashboards:edit"},
		},
	}, permissions.queries)
	require.Equal(t, []store.PermissionsQuery{
		{
			UserID:        1,
			TeamIDs:       []int64{10},
			Role:          "Viewer",
			IsServerAdmin: false,
		},
	}, permissions.presenceQueries)
}

func TestService_LegacyCheckCompositeStoreFailure(t *testing.T) {
	for _, tc := range []struct {
		name       string
		expression *authzextv1.LegacyExpression
		failAction string
	}{
		{
			name: "any denies when loading a later action fails",
			expression: legacyAnyExpression(
				legacyPermissionExpression("dashboards:read"),
				legacyPermissionExpression("folders:read"),
			),
			failAction: "folders:read",
		},
		{
			name:       "empty all denies when checking permission presence fails",
			expression: legacyAllExpression(),
			failAction: "",
		},
		{
			name: "nested empty all denies when checking permission presence fails",
			expression: legacyAnyExpression(
				legacyPermissionExpression("users:delete"),
				legacyAllExpression(),
			),
			failAction: "",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := NewTestService("u-1", []accesscontrol.Permission{
				{
					Action: "dashboards:read",
					Scope:  "*",
				},
			}, nil)
			s.permissionStore = &legacyFailingActionStore{
				PermissionStore: s.permissionStore,
				action:          tc.failAction,
			}

			response, err := s.LegacyCheck(legacyCheckContext(t), &authzextv1.LegacyCheckRequest{
				Namespace:  "org-12",
				Subject:    "user:u-1",
				Expression: tc.expression,
			})

			require.NoError(t, err)
			require.False(t, response.GetAllowed())
			require.Contains(t, response.GetError(), "permission store unavailable")
		})
	}
}

type legacyFailingActionStore struct {
	store.PermissionStore
	action string
}

func (s *legacyFailingActionStore) GetUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query store.PermissionsQuery,
) ([]accesscontrol.Permission, error) {
	if query.Action == s.action {
		return nil, errors.New("permission store unavailable")
	}

	return s.PermissionStore.GetUserPermissions(ctx, ns, query)
}

func (s *legacyFailingActionStore) HasUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query store.PermissionsQuery,
) (bool, error) {
	if query.Action == s.action {
		return false, errors.New("permission store unavailable")
	}

	return s.PermissionStore.HasUserPermissions(ctx, ns, query)
}
