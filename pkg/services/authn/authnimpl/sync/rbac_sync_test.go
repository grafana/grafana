package sync

import (
	"context"
	"errors"
	"testing"

	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	permreg "github.com/grafana/grafana/pkg/services/accesscontrol/permreg/test"
	"github.com/grafana/grafana/pkg/services/authn"
	rbac "github.com/grafana/grafana/pkg/services/authz/rbac"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func setCloudRBACRolesFlag(t *testing.T, enabled bool) {
	t.Helper()
	provider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagCloudRBACRoles: {
			Key:            featuremgmt.FlagCloudRBACRoles,
			Variants:       map[string]any{"on": enabled},
			DefaultVariant: "on",
		},
	})
}

func TestRBACSync_SyncPermission(t *testing.T) {
	type testCase struct {
		name                string
		identity            *authn.Identity
		expectedPermissions map[string][]string
	}
	testCases := []testCase{
		{
			name:     "enriches the identity successfully when SyncPermissions is true",
			identity: &authn.Identity{ID: "2", Type: claims.TypeUser, OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: true}},
			expectedPermissions: map[string][]string{
				accesscontrol.ActionUsersRead:  {accesscontrol.ScopeUsersAll},
				accesscontrol.ActionUsersWrite: {accesscontrol.ScopeUsersAll},
				"dashboards:read":              {"dashboards:uid:*", "folders:uid:*"},
				"dashboards:write":             {"dashboards:uid:*", "folders:uid:*"},
				"dashboards:delete":            {"dashboards:uid:*", "folders:uid:*"},
				"dashboards:create":            {"dashboards:uid:*", "folders:uid:*"},
			},
		},
		{
			name:                "does not load the permissions when SyncPermissions is false",
			identity:            &authn.Identity{ID: "2", Type: claims.TypeUser, OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: false}},
			expectedPermissions: nil,
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			s := setupTestEnv(t)

			err := s.SyncPermissionsHook(context.Background(), tt.identity, &authn.Request{})
			require.NoError(t, err)

			require.Equal(t, len(tt.expectedPermissions), len(tt.identity.Permissions[tt.identity.OrgID]))
			for action, scopes := range tt.expectedPermissions {
				require.ElementsMatch(t, scopes, tt.identity.Permissions[tt.identity.OrgID][action])
			}
		})
	}
}

func TestRBACSync_FetchPermissions(t *testing.T) {
	type testCase struct {
		name                string
		identity            *authn.Identity
		expectedPermissions map[string][]string
	}
	testCases := []testCase{
		{
			name: "restrict permissions from store",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						RestrictedActions: []string{accesscontrol.ActionUsersRead},
					},
				},
			},
			expectedPermissions: map[string][]string{accesscontrol.ActionUsersRead: {accesscontrol.ScopeUsersAll}},
		},
		{
			name: "fetch roles permissions",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						Roles: []string{"fixed:teams:reader"},
					},
				},
			},
			expectedPermissions: map[string][]string{accesscontrol.ActionTeamsRead: {accesscontrol.ScopeTeamsAll}},
		},
		{
			name: "robust to missing roles",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						Roles: []string{"fixed:teams:reader", "fixed:unknown:role"},
					},
				},
			},
			expectedPermissions: map[string][]string{accesscontrol.ActionTeamsRead: {accesscontrol.ScopeTeamsAll}},
		},
		{
			name: "fetch permissions from permissions registry",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						AllowedActions: []string{"dashboards:read"},
					},
				},
			},
			expectedPermissions: map[string][]string{"dashboards:read": {"dashboards:uid:*", "folders:uid:*"}},
		},
		{
			name: "fetch scopeless permissions from permissions registry",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						AllowedActions: []string{"test-app:read"},
					},
				},
			},
			expectedPermissions: map[string][]string{"test-app:read": {""}},
		},
		{
			name: "robust to unknown actions",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						AllowedActions: []string{"unknown:read"},
					},
				},
			},
			expectedPermissions: map[string][]string{},
		},
		{
			name: "restrict permissions from roles and registry",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						RestrictedActions: []string{accesscontrol.ActionUsersWrite, accesscontrol.ActionTeamsWrite, "dashboards:read"},
						AllowedActions:    []string{"dashboards:read"},
						Roles:             []string{"fixed:teams:reader", "fixed:teams:writer"},
					},
				},
			},
			expectedPermissions: map[string][]string{
				"dashboards:read":              {"dashboards:uid:*", "folders:uid:*"},
				accesscontrol.ActionTeamsWrite: {accesscontrol.ScopeTeamsAll},
			},
		},
		{
			name: "empty restricted actions results in no permissions",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						RestrictedActions: []string{},
					},
				},
			},
			expectedPermissions: map[string][]string{},
		},
		{
			name: "restrict permissions with K8s format",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						K8sRestrictedActions: []string{"dashboard.grafana.app/dashboards:get"},
					},
				},
			},
			expectedPermissions: map[string][]string{
				"dashboards:read": {"dashboards:uid:*", "folders:uid:*"},
			},
		},
		{
			name: "restrict permissions with mixed K8s and Grafana formats",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						K8sRestrictedActions: []string{"dashboard.grafana.app/dashboards:get"},
						RestrictedActions:    []string{accesscontrol.ActionUsersRead},
					},
				},
			},
			expectedPermissions: map[string][]string{
				"dashboards:read":             {"dashboards:uid:*", "folders:uid:*"},
				accesscontrol.ActionUsersRead: {accesscontrol.ScopeUsersAll},
			},
		},
		{
			name: "restrict permissions with K8s wildcard verb",
			identity: &authn.Identity{
				ID: "2", Type: claims.TypeUser, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						K8sRestrictedActions: []string{"dashboard.grafana.app/dashboards:*"},
					},
				},
			},
			expectedPermissions: map[string][]string{
				"dashboards:read":   {"dashboards:uid:*", "folders:uid:*"},
				"dashboards:write":  {"dashboards:uid:*", "folders:uid:*"},
				"dashboards:delete": {"dashboards:uid:*", "folders:uid:*"},
				"dashboards:create": {"dashboards:uid:*", "folders:uid:*"},
			},
		},
		{
			name: "access policy with K8s token permissions translates correctly",
			identity: &authn.Identity{
				ID: "ap-uid", Type: claims.TypeAccessPolicy, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchPermissionsParams: authn.FetchPermissionsParams{
						K8s: []string{"dashboard.grafana.app/dashboards:get"},
					},
				},
			},
			expectedPermissions: map[string][]string{
				"dashboards:read": {"dashboards:uid:*", "folders:uid:*"},
			},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			s := setupTestEnv(t)

			err := s.SyncPermissionsHook(context.Background(), tt.identity, &authn.Request{})
			require.NoError(t, err)

			require.Equal(t, len(tt.expectedPermissions), len(tt.identity.Permissions[tt.identity.OrgID]))
			for action, scopes := range tt.expectedPermissions {
				require.ElementsMatch(t, scopes, tt.identity.Permissions[tt.identity.OrgID][action])
			}
		})
	}
}

func TestRBACSync_FetchPermissions_AccessPolicyNoTokenPermissions(t *testing.T) {
	acMock := &acmock.Mock{
		GetUserPermissionsFunc: func(ctx context.Context, siu identity.Requester, o accesscontrol.Options) ([]accesscontrol.Permission, error) {
			t.Fatal("GetUserPermissions should not be called for access policy subjects")
			return nil, nil
		},
	}

	s := &RBACSync{
		ac:           acMock,
		log:          log.NewNopLogger(),
		tracer:       tracing.InitializeTracerForTest(),
		permRegistry: permreg.ProvidePermissionRegistry(t),
		mapper:       rbac.NewMapperRegistry(),
	}

	ident := &authn.Identity{
		ID: "ap-uid", Type: claims.TypeAccessPolicy, OrgID: 1,
		ClientParams: authn.ClientParams{
			SyncPermissions: true,
		},
	}

	err := s.SyncPermissionsHook(context.Background(), ident, &authn.Request{})
	require.NoError(t, err)
	require.Empty(t, ident.Permissions[ident.OrgID])
}

func TestRBACSync_SyncCloudRoles(t *testing.T) {
	type testCase struct {
		desc           string
		module         string
		stackID        string
		identity       *authn.Identity
		syncErr        error
		expectedErr    error
		expectedCalled bool
	}

	tests := []testCase{
		{
			desc:    "should call sync when authenticated with grafana com and has viewer role",
			module:  login.GrafanaComAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
			},
			expectedErr:    nil,
			expectedCalled: true,
		},
		{
			desc:    "should not call sync when not running in Grafana Cloud",
			module:  login.GrafanaComAuthModule,
			stackID: "",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			expectedErr:    nil,
			expectedCalled: false,
		},
		{
			desc:    "should call sync when authenticated with grafana com and has editor role",
			module:  login.GrafanaComAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
			},
			expectedErr:    nil,
			expectedCalled: true,
		},
		{
			desc:    "should call sync when authenticated with grafana com and has admin role",
			module:  login.GrafanaComAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			expectedErr:    nil,
			expectedCalled: true,
		},
		{
			desc:    "should call sync and not block login when authenticated with grafana com and has none role",
			module:  login.GrafanaComAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleNone},
			},
			expectedErr:    nil,
			expectedCalled: true,
		},
		{
			desc:    "should not block login when authenticated with grafana com and has an unmapped role",
			module:  login.GrafanaComAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleType("something else")},
			},
			expectedErr:    nil,
			expectedCalled: false,
		},
		{
			desc:    "should not call sync when not authenticated with grafana com",
			module:  login.LDAPAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			expectedErr:    nil,
			expectedCalled: false,
		},
		{
			desc:    "should not fail login when a cloud role is not registered",
			module:  login.GrafanaComAuthModule,
			stackID: "1",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
			},
			syncErr:        accesscontrol.ErrRoleNotFound,
			expectedErr:    nil,
			expectedCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			setCloudRBACRolesFlag(t, true)
			var called bool
			s := &RBACSync{
				ac: &acmock.Mock{
					SyncUserRolesFunc: func(_ context.Context, _ int64, _ accesscontrol.SyncUserRolesCommand) error {
						called = true
						return tt.syncErr
					},
				},
				log:    log.NewNopLogger(),
				tracer: tracing.InitializeTracerForTest(),
				cfg:    &setting.Cfg{StackID: tt.stackID},
			}

			req := &authn.Request{}
			req.SetMeta(authn.MetaKeyAuthModule, tt.module)

			err := s.SyncCloudRoles(context.Background(), tt.identity, req)
			assert.ErrorIs(t, tt.expectedErr, err)
			assert.Equal(t, tt.expectedCalled, called)
		})
	}
}

func TestRBACSync_cloudRolesToAddAndRemove(t *testing.T) {
	type testCase struct {
		desc                      string
		identity                  *authn.Identity
		includeSupportTicketRoles bool
		expectedErr               error
		expectedRolesToAdd        []string
		expectedRolesToRemove     []string
	}

	tests := []testCase{
		{
			desc: "should map Cloud Viewer to Grafana Cloud Viewer and Support ticket reader when support ticket roles are included",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
			},
			includeSupportTicketRoles: true,
			expectedErr:               nil,
			expectedRolesToAdd: []string{
				accesscontrol.FixedCloudViewerRole,
				accesscontrol.FixedCloudSupportTicketReader,
			},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudEditorRole,
				accesscontrol.FixedCloudSupportTicketAdmin,
				accesscontrol.FixedCloudAdminRole,
				accesscontrol.FixedCloudSupportTicketAdmin,
			},
		},
		{
			desc: "should map Cloud Editor to Grafana Cloud Editor and Support ticket admin when support ticket roles are included",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
			},
			includeSupportTicketRoles: true,
			expectedErr:               nil,
			expectedRolesToAdd: []string{
				accesscontrol.FixedCloudEditorRole,
				accesscontrol.FixedCloudSupportTicketAdmin,
			},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudViewerRole,
				accesscontrol.FixedCloudSupportTicketReader,
				accesscontrol.FixedCloudAdminRole,
			},
		},
		{
			desc: "should map Cloud Admin to Grafana Cloud Admin and Support ticket admin when support ticket roles are included",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			includeSupportTicketRoles: true,
			expectedErr:               nil,
			expectedRolesToAdd: []string{
				accesscontrol.FixedCloudAdminRole,
				accesscontrol.FixedCloudSupportTicketAdmin,
			},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudViewerRole,
				accesscontrol.FixedCloudSupportTicketReader,
				accesscontrol.FixedCloudEditorRole,
			},
		},
		{
			desc: "should map Cloud Viewer to only the base Grafana Cloud Viewer role when support ticket roles are excluded",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
			},
			includeSupportTicketRoles: false,
			expectedErr:               nil,
			expectedRolesToAdd: []string{
				accesscontrol.FixedCloudViewerRole,
			},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudEditorRole,
				accesscontrol.FixedCloudAdminRole,
			},
		},
		{
			desc: "should map Cloud Admin to only the base Grafana Cloud Admin role when support ticket roles are excluded",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			includeSupportTicketRoles: false,
			expectedErr:               nil,
			expectedRolesToAdd: []string{
				accesscontrol.FixedCloudAdminRole,
			},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudViewerRole,
				accesscontrol.FixedCloudEditorRole,
			},
		},
		{
			desc: "should map None to no cloud roles and remove all others when support ticket roles are included",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleNone},
			},
			includeSupportTicketRoles: true,
			expectedErr:               nil,
			expectedRolesToAdd:        []string{},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudViewerRole,
				accesscontrol.FixedCloudSupportTicketReader,
				accesscontrol.FixedCloudEditorRole,
				accesscontrol.FixedCloudSupportTicketAdmin,
				accesscontrol.FixedCloudAdminRole,
				accesscontrol.FixedCloudSupportTicketAdmin,
			},
		},
		{
			desc: "should map None to no cloud roles and remove only base roles when support ticket roles are excluded",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleNone},
			},
			includeSupportTicketRoles: false,
			expectedErr:               nil,
			expectedRolesToAdd:        []string{},
			expectedRolesToRemove: []string{
				accesscontrol.FixedCloudViewerRole,
				accesscontrol.FixedCloudEditorRole,
				accesscontrol.FixedCloudAdminRole,
			},
		},
		{
			desc: "should return an error for an unrecognized role",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleType("something else")},
			},
			includeSupportTicketRoles: true,
			expectedErr:               errInvalidCloudRole,
			expectedRolesToAdd:        []string{},
			expectedRolesToRemove:     []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			setCloudRBACRolesFlag(t, tt.includeSupportTicketRoles)
			s := &RBACSync{}

			rolesToAdd, rolesToRemove, err := s.cloudRolesToAddAndRemove(context.Background(), tt.identity)
			assert.ErrorIs(t, tt.expectedErr, err)
			assert.ElementsMatch(t, tt.expectedRolesToAdd, rolesToAdd)
			assert.ElementsMatch(t, tt.expectedRolesToRemove, rolesToRemove)
		})
	}
}

func TestRBACSync_ClearUserPermissionCacheHook(t *testing.T) {
	type testCase struct {
		desc           string
		identityType   claims.IdentityType
		loginErr       error
		expectedCalled bool
	}

	tests := []testCase{
		{
			desc:           "should clear the permission cache when the user logged in successfully",
			identityType:   claims.TypeUser,
			loginErr:       nil,
			expectedCalled: true,
		},
		{
			desc:           "should skip clearing the permission cache when the user failed to log in",
			identityType:   claims.TypeUser,
			loginErr:       errors.New("failed to log in"),
			expectedCalled: false,
		},
		{
			desc:           "should skip clearing the permission cache when the identity is not a user",
			identityType:   claims.TypeServiceAccount,
			loginErr:       nil,
			expectedCalled: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var called bool
			s := &RBACSync{
				ac: &acmock.Mock{
					ClearUserPermissionCacheFunc: func(_ identity.Requester) {
						called = true
					},
				},
				log:    log.NewNopLogger(),
				tracer: tracing.InitializeTracerForTest(),
			}
			identity := &authn.Identity{
				ID:       "1",
				Type:     tt.identityType,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
			}
			req := &authn.Request{}

			s.ClearUserPermissionCacheHook(context.Background(), identity, req, tt.loginErr)
			assert.Equal(t, tt.expectedCalled, called)
		})
	}
}

func TestRBACSync_ClearUserPermissionCacheHook_NilIdentity(t *testing.T) {
	var called bool
	s := &RBACSync{
		ac: &acmock.Mock{
			ClearUserPermissionCacheFunc: func(_ identity.Requester) {
				called = true
			},
		},
		log:    log.NewNopLogger(),
		tracer: tracing.InitializeTracerForTest(),
	}

	require.NotPanics(t, func() {
		s.ClearUserPermissionCacheHook(context.Background(), nil, &authn.Request{}, nil)
	})
	assert.False(t, called)
}

func TestRBACSync_translateK8sPermissions(t *testing.T) {
	type testCase struct {
		name          string
		k8sPerms      []string
		expectedPerms []accesscontrol.Permission
		expectedError error
	}

	tests := []testCase{
		{
			name: "should translate folder.grafana.app/folders:get to folders:read",
			k8sPerms: []string{
				"folder.grafana.app/folders:get",
			},
			expectedPerms: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:*"},
			},
			expectedError: nil,
		},
		{
			name: "should translate resource with wildcard verb",
			k8sPerms: []string{
				"folder.grafana.app/folders:*",
			},
			expectedPerms: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:*"},
				{Action: "folders:write", Scope: "folders:uid:*"},
				{Action: "folders:delete", Scope: "folders:uid:*"},
				{Action: "folders:create", Scope: "folders:uid:*"},
				{Action: "folders.permissions:read", Scope: "folders:uid:*"},
				{Action: "folders.permissions:write", Scope: "folders:uid:*"},
			},
			expectedError: nil,
		},
		{
			name: "should handle invalid permission format",
			k8sPerms: []string{
				"invalid-format",
			},
			expectedPerms: []accesscontrol.Permission{},
			expectedError: nil,
		},
		{
			name: "should handle unknown resource",
			k8sPerms: []string{
				"folder.grafana.app/unknown:get",
			},
			expectedPerms: []accesscontrol.Permission{},
			expectedError: nil,
		},
		{
			name: "should handle unknown verb",
			k8sPerms: []string{
				"folder.grafana.app/folders:unknown",
			},
			expectedPerms: []accesscontrol.Permission{},
			expectedError: nil,
		},
		{
			name: "should handle group:verb format",
			k8sPerms: []string{
				"folder.grafana.app:get",
			},
			expectedPerms: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:*"},
			},
			expectedError: nil,
		},
		{
			name: "should handle group:* format",
			k8sPerms: []string{
				"folder.grafana.app:*",
			},
			expectedPerms: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:*"},
				{Action: "folders:write", Scope: "folders:uid:*"},
				{Action: "folders:delete", Scope: "folders:uid:*"},
				{Action: "folders:create", Scope: "folders:uid:*"},
				{Action: "folders.permissions:read", Scope: "folders:uid:*"},
				{Action: "folders.permissions:write", Scope: "folders:uid:*"},
			},
			expectedError: nil,
		},
		{
			name: "should handle unknown group in group:verb format",
			k8sPerms: []string{
				"unknown.grafana.app:get",
			},
			expectedPerms: []accesscontrol.Permission{},
			expectedError: nil,
		},
		{
			name: "should handle unknown verb in group:verb format",
			k8sPerms: []string{
				"folder.grafana.app:unknownverb",
			},
			expectedPerms: []accesscontrol.Permission{},
			expectedError: nil,
		},
		{
			name: "should handle multiple group:verb permissions",
			k8sPerms: []string{
				"folder.grafana.app:get",
				"folder.grafana.app:create",
			},
			expectedPerms: []accesscontrol.Permission{
				{Action: "folders:read", Scope: "folders:uid:*"},
				{Action: "folders:create", Scope: "folders:uid:*"},
			},
			expectedError: nil,
		},
		{
			name: "should skip invalid permissions group/resource/additional/part:verb",
			k8sPerms: []string{
				"folder.grafana.app/folder/fold1/subresource:get",
			},
			expectedPerms: []accesscontrol.Permission{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := setupTestEnv(t)
			perms := s.translateK8sPermissions(context.Background(), tt.k8sPerms)
			assert.ElementsMatch(t, tt.expectedPerms, perms)
		})
	}
}

func setupTestEnv(t *testing.T) *RBACSync {
	acMock := &acmock.Mock{
		GetUserPermissionsFunc: func(ctx context.Context, siu identity.Requester, o accesscontrol.Options) ([]accesscontrol.Permission, error) {
			return []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead, Scope: accesscontrol.ScopeUsersAll},
				{Action: accesscontrol.ActionUsersWrite, Scope: accesscontrol.ScopeUsersAll},
				{Action: "dashboards:read", Scope: "dashboards:uid:*"},
				{Action: "dashboards:read", Scope: "folders:uid:*"},
				{Action: "dashboards:write", Scope: "dashboards:uid:*"},
				{Action: "dashboards:write", Scope: "folders:uid:*"},
				{Action: "dashboards:delete", Scope: "dashboards:uid:*"},
				{Action: "dashboards:delete", Scope: "folders:uid:*"},
				{Action: "dashboards:create", Scope: "dashboards:uid:*"},
				{Action: "dashboards:create", Scope: "folders:uid:*"},
			}, nil
		},
		GetRoleByNameFunc: func(ctx context.Context, i int64, s string) (*accesscontrol.RoleDTO, error) {
			if s == "fixed:teams:reader" {
				return &accesscontrol.RoleDTO{
					ID: 1, Name: "fixed:teams:reader",
					Permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsRead, Scope: accesscontrol.ScopeTeamsAll}},
				}, nil
			}
			if s == "fixed:teams:writer" {
				return &accesscontrol.RoleDTO{
					ID: 1, Name: "fixed:teams:writer",
					Permissions: []accesscontrol.Permission{{Action: accesscontrol.ActionTeamsWrite, Scope: accesscontrol.ScopeTeamsAll}},
				}, nil
			}
			return nil, accesscontrol.ErrRoleNotFound
		},
	}
	permRegistry := permreg.ProvidePermissionRegistry(t)

	require.NoError(t, permRegistry.RegisterPermission("folders:write", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("folders:create", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("folders:delete", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("folders.permissions:read", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("folders.permissions:write", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:read", "dashboards:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:read", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:write", "dashboards:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:write", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:create", "dashboards:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:create", "folders:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:delete", "dashboards:uid:"))
	require.NoError(t, permRegistry.RegisterPermission("dashboards:delete", "folders:uid:"))

	s := &RBACSync{
		ac:           acMock,
		log:          log.NewNopLogger(),
		tracer:       tracing.InitializeTracerForTest(),
		permRegistry: permRegistry,
		mapper:       rbac.NewMapperRegistry(),
	}
	return s
}

func TestRBACSync_DatasourceTokenPermissions(t *testing.T) {
	allActions := []string{
		"datasources:create", "datasources:read", "datasources:write", "datasources:delete",
		"datasources:query", "datasources.permissions:read", "datasources.permissions:write",
		"datasources.caching:read", "datasources.caching:write",
	}
	for _, tc := range []struct {
		grant   string
		actions []string
	}{
		{"loki.datasource.grafana.app:get", []string{"datasources:read", "datasources.caching:read"}},
		{"loki.datasource.grafana.app:*", allActions},
		{"query.grafana.app:*", []string{"datasources:query"}},
		{"query.grafana.app:create", []string{"datasources:query"}},
		{"query.grafana.app:get", nil},
		{"query.grafana.app:update", nil},
		{"loki.datasource.grafana.app/datasources:get", []string{"datasources:read"}},
		{"query.grafana.app/query:create", []string{"datasources:query"}},
		{"datasource.grafana.app/query:*", []string{"datasources:query"}},
		{"query.grafana.app/query:get", nil},
		{"foo.bar.datasource.grafana.app:*", nil},
	} {
		for _, delegated := range []bool{false, true} {
			name := tc.grant
			if delegated {
				name += "/delegated"
			}
			t.Run(name, func(t *testing.T) {
				s := setupTestEnv(t)
				for _, action := range allActions {
					scope := "datasources:uid:"
					if action == "datasources:create" {
						scope = ""
					}
					require.NoError(t, s.permRegistry.RegisterPermission(action, scope))
				}
				params := authn.FetchPermissionsParams{K8s: []string{tc.grant}}
				if delegated {
					params = authn.FetchPermissionsParams{
						AllowedActions:       allActions,
						K8sRestrictedActions: []string{tc.grant},
					}
				}
				ident := &authn.Identity{
					ID: "datasource-token", Type: claims.TypeAccessPolicy, OrgID: 1,
					ClientParams: authn.ClientParams{SyncPermissions: true, FetchPermissionsParams: params},
				}
				require.NoError(t, s.SyncPermissionsHook(context.Background(), ident, &authn.Request{}))
				expected := map[string][]string{}
				for _, action := range tc.actions {
					scope := "datasources:uid:*"
					if action == "datasources:create" {
						scope = ""
					}
					expected[action] = []string{scope}
				}
				// Exact equality also ensures query aliases cannot grant configuration or caching access.
				assert.Equal(t, expected, ident.Permissions[1])
				if delegated {
					assert.Equal(t, []string{tc.grant}, ident.ClientParams.FetchPermissionsParams.K8sRestrictedActions)
				} else {
					assert.Equal(t, []string{tc.grant}, ident.ClientParams.FetchPermissionsParams.K8s)
				}
			})
		}
	}
}

// Model a plugin-specific resource using a real mapping, without changing the
// production registry to add a resource that does not exist yet.
type pluginResourceMapper struct {
	rbac.MapperRegistry
	custom rbac.Mapping
}

func (m pluginResourceMapper) GetAll(group string) []rbac.Mapping {
	mappings := m.MapperRegistry.GetAll(group)
	if group == "loki.datasource.grafana.app" {
		mappings = append(mappings, m.custom)
	}
	return mappings
}

func (m pluginResourceMapper) Get(group, resource, subresource string) (rbac.Mapping, bool) {
	if group == "loki.datasource.grafana.app" && resource == "custom" && subresource == "" {
		return m.custom, true
	}
	return m.MapperRegistry.Get(group, resource, subresource)
}

func TestRBACSync_DatasourceGroupWithCustomResource(t *testing.T) {
	for _, tc := range []struct {
		grant    string
		expected map[string][]string
	}{
		{"loki.datasource.grafana.app:get", map[string][]string{
			"datasources:read":         {"datasources:uid:*"},
			"datasources.caching:read": {"datasources:uid:*"},
			"folders:read":             {"folders:uid:*"},
		}},
		{"loki.datasource.grafana.app/custom:get", map[string][]string{
			"folders:read": {"folders:uid:*"},
		}},
		{"loki.datasource.grafana.app/datasources:get", map[string][]string{
			"datasources:read": {"datasources:uid:*"},
		}},
	} {
		t.Run(tc.grant, func(t *testing.T) {
			s := setupTestEnv(t)
			for _, action := range []string{"datasources:read", "datasources.caching:read"} {
				require.NoError(t, s.permRegistry.RegisterPermission(action, "datasources:uid:"))
			}
			custom, ok := s.mapper.Get("folder.grafana.app", "folders", "")
			require.True(t, ok)
			s.mapper = pluginResourceMapper{MapperRegistry: s.mapper, custom: custom}
			ident := &authn.Identity{
				ID: "datasource-token", Type: claims.TypeAccessPolicy, OrgID: 1,
				ClientParams: authn.ClientParams{
					SyncPermissions:        true,
					FetchPermissionsParams: authn.FetchPermissionsParams{K8s: []string{tc.grant}},
				},
			}
			require.NoError(t, s.SyncPermissionsHook(context.Background(), ident, &authn.Request{}))
			assert.Equal(t, tc.expected, ident.Permissions[1])
		})
	}
}
