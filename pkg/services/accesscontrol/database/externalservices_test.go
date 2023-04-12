package database

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestAccessControlStore_SaveExternalServiceRole(t *testing.T) {
	tests := []struct {
		name    string
		cmds    []accesscontrol.SaveExternalServiceRoleCommand
		wantErr bool
	}{
		{
			name: "create app role",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{{
				ExternalServiceID: "app1",
				Global:            true,
				ServiceAccountID:  1,
				Permissions: []accesscontrol.Permission{
					{Action: "users:read", Scope: "users:id:1"},
					{Action: "users:read", Scope: "users:id:2"},
				},
			}},
			wantErr: false,
		},
		{
			name: "update app role",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:write", Scope: "users:id:1"},
						{Action: "users:write", Scope: "users:id:2"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "allow switching role from local to global and back",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{
				{
					ExternalServiceID: "app1",
					OrgID:             1,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					OrgID:             1,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
			},
			wantErr: false,
		},
		{
			name: "edge case - remove all permissions",
			cmds: []accesscontrol.SaveExternalServiceRoleCommand{
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:read", Scope: "users:id:2"},
					},
				},
				{
					ExternalServiceID: "app1",
					Global:            true,
					ServiceAccountID:  1,
					Permissions:       []accesscontrol.Permission{},
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			s := &AccessControlStore{
				sql: db.InitTestDB(t),
			}

			for i := range tt.cmds {
				err := s.SaveExternalServiceRole(ctx, tt.cmds[i])
				if tt.wantErr {
					require.Error(t, err)
					continue
				}
				require.NoError(t, err)

				errDBSession := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
					storedRole, err := getRoleByUID(ctx, sess, fmt.Sprintf("externalservice_%s_permissions", tt.cmds[i].ExternalServiceID))
					require.NoError(t, err)
					require.NotNil(t, storedRole)
					require.Equal(t, tt.cmds[i].Global, storedRole.Global(), "Incorrect global state of the role")
					require.Equal(t, tt.cmds[i].OrgID, storedRole.OrgID, "Incorrect OrgID of the role")

					storedPerm, err := getRolePermissions(ctx, sess, storedRole.ID)
					require.NoError(t, err)
					for i := range storedPerm {
						storedPerm[i] = accesscontrol.Permission{Action: storedPerm[i].Action, Scope: storedPerm[i].Scope}
					}
					require.ElementsMatch(t, tt.cmds[i].Permissions, storedPerm)

					var assignment accesscontrol.UserRole
					has, err := sess.Where("role_id = ? AND user_id = ?", storedRole.ID, tt.cmds[i].ServiceAccountID).Get(&assignment)
					require.NoError(t, err)
					require.True(t, has)
					require.Equal(t, tt.cmds[i].Global, assignment.OrgID == accesscontrol.GlobalOrgID, "Incorrect global state of the assignment")
					require.Equal(t, tt.cmds[i].OrgID, assignment.OrgID, "Incorrect OrgID for the role assignment")

					return nil
				})
				require.NoError(t, errDBSession)
			}
		})
	}
}
