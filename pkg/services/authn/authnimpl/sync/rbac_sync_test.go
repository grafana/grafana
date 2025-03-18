package sync

import (
	"context"
	"testing"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	permreg "github.com/grafana/grafana/pkg/services/accesscontrol/permreg/test"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

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

func TestRBACSync_SyncCloudRoles(t *testing.T) {
	type testCase struct {
		desc           string
		module         string
		identity       *authn.Identity
		expectedErr    error
		expectedCalled bool
	}

	tests := []testCase{
		{
			desc:   "should call sync when authenticated with grafana com and has viewer role",
			module: login.GrafanaComAuthModule,
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
			desc:   "should call sync when authenticated with grafana com and has editor role",
			module: login.GrafanaComAuthModule,
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
			desc:   "should call sync when authenticated with grafana com and has admin role",
			module: login.GrafanaComAuthModule,
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
			desc:   "should not call sync when authenticated with grafana com and has invalid role",
			module: login.GrafanaComAuthModule,
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleType("something else")},
			},
			expectedErr:    errInvalidCloudRole,
			expectedCalled: false,
		},
		{
			desc:   "should not call sync when not authenticated with grafana com",
			module: login.LDAPAuthModule,
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			expectedErr:    nil,
			expectedCalled: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var called bool
			s := &RBACSync{
				ac: &acmock.Mock{
					SyncUserRolesFunc: func(_ context.Context, _ int64, _ accesscontrol.SyncUserRolesCommand) error {
						called = true
						return nil
					},
				},
				log:    log.NewNopLogger(),
				tracer: tracing.InitializeTracerForTest(),
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
		desc                  string
		identity              *authn.Identity
		expectedErr           error
		expectedRolesToAdd    []string
		expectedRolesToRemove []string
	}

	tests := []testCase{
		{
			desc: "should map Cloud Viewer to Grafana Cloud Viewer and Support ticket reader",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleViewer},
			},
			expectedErr: nil,
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
			desc: "should map Cloud Editor to Grafana Cloud Editor and Support ticket admin",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleEditor},
			},
			expectedErr: nil,
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
			desc: "should map Cloud Admin to Grafana Cloud Admin and Support ticket admin",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleAdmin},
			},
			expectedErr: nil,
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
			desc: "should return an error for not supported role",
			identity: &authn.Identity{
				ID:       "1",
				Type:     claims.TypeUser,
				OrgID:    1,
				OrgRoles: map[int64]org.RoleType{1: org.RoleNone},
			},
			expectedErr:           errInvalidCloudRole,
			expectedRolesToAdd:    []string{},
			expectedRolesToRemove: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			rolesToAdd, rolesToRemove, err := cloudRolesToAddAndRemove(tt.identity)
			assert.ErrorIs(t, tt.expectedErr, err)
			assert.ElementsMatch(t, tt.expectedRolesToAdd, rolesToAdd)
			assert.ElementsMatch(t, tt.expectedRolesToRemove, rolesToRemove)
		})
	}
}

func setupTestEnv(t *testing.T) *RBACSync {
	acMock := &acmock.Mock{
		GetUserPermissionsFunc: func(ctx context.Context, siu identity.Requester, o accesscontrol.Options) ([]accesscontrol.Permission, error) {
			return []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead, Scope: accesscontrol.ScopeUsersAll},
				{Action: accesscontrol.ActionUsersWrite, Scope: accesscontrol.ScopeUsersAll},
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
	s := &RBACSync{
		ac:           acMock,
		log:          log.NewNopLogger(),
		tracer:       tracing.InitializeTracerForTest(),
		permRegistry: permRegistry,
	}
	return s
}
