package sync

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPermissionsSync_SyncPermission(t *testing.T) {
	type testCase struct {
		name                string
		identity            *authn.Identity
		rbacDisabled        bool
		expectedPermissions []accesscontrol.Permission
	}
	testCases := []testCase{
		{
			name:         "enriches the identity successfully when SyncPermissions is true",
			identity:     &authn.Identity{ID: "user:2", OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: true}},
			rbacDisabled: false,
			expectedPermissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead},
			},
		},
		{
			name:         "does not load the permissions when SyncPermissions is false",
			identity:     &authn.Identity{ID: "user:2", OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: true}},
			rbacDisabled: false,
			expectedPermissions: []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead},
			},
		},
		{
			name:                "does not load the permissions when RBAC is disabled",
			rbacDisabled:        true,
			identity:            &authn.Identity{ID: "user:2", OrgID: 1, ClientParams: authn.ClientParams{SyncPermissions: true}},
			expectedPermissions: []accesscontrol.Permission{},
		},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			s := setupTestEnv(tt.rbacDisabled)

			err := s.SyncPermissionsHook(context.Background(), tt.identity, &authn.Request{})
			require.NoError(t, err)

			if !tt.rbacDisabled {
				assert.Equal(t, 1, len(tt.identity.Permissions))
				assert.Equal(t, accesscontrol.GroupScopesByAction(tt.expectedPermissions), tt.identity.Permissions[tt.identity.OrgID])
			} else {
				assert.Equal(t, 0, len(tt.identity.Permissions))
			}
		})
	}
}

func setupTestEnv(rbacDisabled bool) *PermissionsSync {
	acMock := &acmock.Mock{
		IsDisabledFunc: func() bool {
			return rbacDisabled
		},
		GetUserPermissionsFunc: func(ctx context.Context, siu *user.SignedInUser, o accesscontrol.Options) ([]accesscontrol.Permission, error) {
			return []accesscontrol.Permission{
				{Action: accesscontrol.ActionUsersRead},
			}, nil
		},
	}
	s := &PermissionsSync{
		ac:  acMock,
		log: log.NewNopLogger(),
	}
	return s
}
