package sync

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
)

func TestRBACSync_SyncPermission(t *testing.T) {
	type testCase struct {
		name                string
		identity            *authn.Identity
		expectedPermissions []accesscontrol.Permission
	}
	testCases := []testCase{
		{
			name:     "enriches the identity successfully when SyncPermissions is true",
			identity: &authn.Identity{ID: identity.MustParseTypedID("user:2"), OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: true}},
			expectedPermissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead},
			},
		},
		{
			name:     "does not load the permissions when SyncPermissions is false",
			identity: &authn.Identity{ID: identity.MustParseTypedID("user:2"), OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: true}},
			expectedPermissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead},
			},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			s := setupTestEnv()

			err := s.SyncPermissionsHook(context.Background(), tt.identity, &authn.Request{})
			require.NoError(t, err)

			assert.Equal(t, 1, len(tt.identity.Permissions))
			assert.Equal(t, accesscontrol.GroupScopesByActionContext(context.Background(), tt.expectedPermissions), tt.identity.Permissions[tt.identity.OrgID])
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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
				ID:       identity.NewTypedID(identity.TypeUser, 1),
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

func setupTestEnv() *RBACSync {
	acMock := &acmock.Mock{
		GetUserPermissionsFunc: func(ctx context.Context, siu identity.Requester, o accesscontrol.Options) ([]accesscontrol.Permission, error) {
			return []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead},
			}, nil
		},
	}
	s := &RBACSync{
		ac:     acMock,
		log:    log.NewNopLogger(),
		tracer: tracing.InitializeTracerForTest(),
	}
	return s
}
