package rbac

import (
	"context"
	"errors"
	"testing"

	"github.com/go-jose/go-jose/v4/jwt"
	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func TestService_LegacyCheck(t *testing.T) {
	for _, tc := range []struct {
		name        string
		subject     string
		action      string
		scopes      []string
		permissions []accesscontrol.Permission
		allowed     bool
	}{
		{
			name:    "direct permission",
			subject: "user:u-1",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"},
			},
			allowed: true,
		},
		{
			name:    "action set",
			subject: "user:u-1",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:view", Scope: "dashboards:uid:dash-1"},
			},
			allowed: true,
		},
		{
			name:    "service account",
			subject: "service-account:u-1",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:view", Scope: "dashboards:*"},
			},
			allowed: true,
		},
		{
			name:    "anonymous",
			subject: "anonymous:0",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:view", Scope: "dashboards:*"},
			},
			allowed: true,
		},
		{
			name:    "renderer",
			subject: "render:0",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			allowed: true,
		},
		{
			name:    "renderer denied",
			subject: "render:0",
			action:  "users:delete",
			scopes:  []string{"*"},
			allowed: false,
		},
		{
			name:    "unrelated action",
			subject: "user:u-1",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:write", Scope: "*"},
			},
			allowed: false,
		},
		{
			name:    "scoped wildcard stays scoped",
			subject: "user:u-1",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "folders:*"},
			},
			allowed: false,
		},
		{
			name:    "settings scopes stay unchanged",
			subject: "user:u-1",
			action:  "settings:read",
			scopes:  []string{"settings:auth:enabled"},
			permissions: []accesscontrol.Permission{
				{Action: "settings:read", Scope: "settings:auth:*"},
			},
			allowed: true,
		},
		{
			name:    "action only",
			subject: "user:u-1",
			action:  "users:create",
			permissions: []accesscontrol.Permission{
				{Action: "users:create"},
			},
			allowed: true,
		},
		{
			name:    "action only without grant",
			subject: "user:u-1",
			action:  "users:create",
			allowed: false,
		},
		{
			name:    "explicit empty scope",
			subject: "user:u-1",
			action:  "users:create",
			scopes:  []string{""},
			permissions: []accesscontrol.Permission{
				{Action: "users:create"},
			},
			allowed: false,
		},
		{
			name:    "alternative scopes",
			subject: "user:u-1",
			action:  "dashboards:read",
			scopes:  []string{"dashboards:uid:missing", "dashboards:uid:dash-1"},
			permissions: []accesscontrol.Permission{
				{Action: "dashboards:read", Scope: "dashboards:uid:dash-1"},
			},
			allowed: true,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := NewTestService("u-1", tc.permissions, nil)
			s.actionResolver = legacyActionResolver{}
			permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
			s.permissionStore = permissions
			// A callback to the old full-snapshot evaluator must not be used.
			evaluator := &recordingUserPermissionsEvaluator{}
			s.userPermissionsEvaluator = evaluator
			resp, err := s.LegacyCheck(legacyCheckContext(t), legacyPermissionRequest(tc.subject, tc.action, tc.scopes...))
			require.NoError(t, err)
			require.Empty(t, resp.GetError())
			require.Equal(t, tc.allowed, resp.GetAllowed())
			require.Nil(t, evaluator.user)
			if tc.subject == "render:0" {
				require.Empty(t, permissions.queries)
			} else {
				require.Len(t, permissions.queries, 1)
				require.Equal(t, tc.action, permissions.queries[0].Action)
				require.Equal(t, s.actionResolver.ResolveAction(tc.action), permissions.queries[0].ActionSets)
			}
		})
	}
}

func TestService_LegacyCheckRejectsInvalidRequests(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*authzextv1.LegacyCheckRequest)
	}{
		{
			name: "namespace mismatch",
			mutate: func(req *authzextv1.LegacyCheckRequest) {
				req.Namespace = "org-13"
			},
		},
		{
			name: "unsupported subject",
			mutate: func(req *authzextv1.LegacyCheckRequest) {
				req.Subject = "api-key:1"
			},
		},
		{
			name: "missing expression",
			mutate: func(req *authzextv1.LegacyCheckRequest) {
				req.Expression = nil
			},
		},
		{
			name: "missing node",
			mutate: func(req *authzextv1.LegacyCheckRequest) {
				req.Expression = &authzextv1.LegacyExpression{}
			},
		},
		{
			name: "missing permission",
			mutate: func(req *authzextv1.LegacyCheckRequest) {
				req.Expression.Node = &authzextv1.LegacyExpression_Permission{}
			},
		},
		{
			name: "missing action",
			mutate: func(req *authzextv1.LegacyCheckRequest) {
				req.Expression.GetPermission().Action = ""
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := setupService()
			permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
			s.permissionStore = permissions
			req := legacyPermissionRequest("user:u-1", "dashboards:read", "dashboards:uid:dash-1")
			tc.mutate(req)
			resp, err := s.LegacyCheck(legacyCheckContext(t), req)
			require.NoError(t, err)
			require.False(t, resp.GetAllowed())
			require.NotEmpty(t, resp.GetError())
			require.Empty(t, permissions.queries)
			require.Zero(t, s.store.(*fakeStore).calls)
		})
	}
}

func TestService_LegacyCheckStoreFailure(t *testing.T) {
	s := NewTestService("u-1", nil, nil)
	s.permissionStore = &legacyPermissionStore{err: errors.New("permission store unavailable")}
	resp, err := s.LegacyCheck(legacyCheckContext(t), legacyPermissionRequest("user:u-1", "dashboards:read", "*"))
	require.NoError(t, err)
	require.False(t, resp.GetAllowed())
	require.Contains(t, resp.GetError(), "permission store unavailable")
}

func TestService_LegacyCheckSkipCache(t *testing.T) {
	s := NewTestService("u-1", []accesscontrol.Permission{{Action: "dashboards:read", Scope: "*"}}, nil)
	f := s.store.(*fakeStore)
	f.basicRole = &store.BasicRole{Role: "Viewer"}
	identityStore := s.identityStore.(*fakeIdentityStore)
	identityStore.userTeams = []int64{10}
	permissions := &legacyPermissionStore{PermissionStore: s.permissionStore}
	s.permissionStore = permissions
	req := legacyPermissionRequest("user:u-1", "dashboards:read", "dashboards:uid:dash-1")
	check := func() store.PermissionsQuery {
		resp, err := s.LegacyCheck(legacyCheckContext(t), req)
		require.NoError(t, err)
		require.Empty(t, resp.GetError())
		require.True(t, resp.GetAllowed())
		return permissions.queries[len(permissions.queries)-1]
	}
	initial := check()
	f.userID = &store.UserIdentifiers{UID: "u-1", ID: 2}
	f.basicRole = &store.BasicRole{Role: "Admin", IsAdmin: true}
	identityStore.userTeams = []int64{20}
	require.Equal(t, initial, check())
	req.SkipCache = true
	refreshed := check()
	require.Equal(t, int64(2), refreshed.UserID)
	require.Equal(t, "Admin", refreshed.Role)
	require.True(t, refreshed.IsServerAdmin)
	require.Equal(t, []int64{20}, refreshed.TeamIDs)
}

func legacyCheckContext(t *testing.T) context.Context {
	return types.WithAuthInfo(t.Context(), authn.NewAccessTokenAuthInfo(authn.Claims[authn.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "service-account:test"},
		Rest:   authn.AccessTokenClaims{Namespace: "org-12"},
	}))
}

func legacyPermissionRequest(subject, action string, scopes ...string) *authzextv1.LegacyCheckRequest {
	return &authzextv1.LegacyCheckRequest{
		Namespace: "org-12",
		Subject:   subject,
		Expression: &authzextv1.LegacyExpression{
			Node: &authzextv1.LegacyExpression_Permission{
				Permission: &authzextv1.LegacyPermission{
					Action: action,
					Scopes: scopes,
				},
			},
		},
	}
}

type legacyActionResolver struct {
	accesscontrol.ActionResolver
}

func (legacyActionResolver) ResolveAction(action string) []string {
	if action == "dashboards:read" {
		return []string{"dashboards:view", "dashboards:edit"}
	}
	return nil
}

type legacyPermissionStore struct {
	store.PermissionStore
	queries         []store.PermissionsQuery
	presenceQueries []store.PermissionsQuery
	err             error
}

func (s *legacyPermissionStore) GetUserPermissions(ctx context.Context, ns types.NamespaceInfo, query store.PermissionsQuery) ([]accesscontrol.Permission, error) {
	s.queries = append(s.queries, query)
	if s.err != nil {
		return nil, s.err
	}
	return s.PermissionStore.GetUserPermissions(ctx, ns, query)
}

func (s *legacyPermissionStore) HasUserPermissions(
	ctx context.Context,
	ns types.NamespaceInfo,
	query store.PermissionsQuery,
) (bool, error) {
	s.presenceQueries = append(s.presenceQueries, query)
	if s.err != nil {
		return false, s.err
	}
	return s.PermissionStore.HasUserPermissions(ctx, ns, query)
}
