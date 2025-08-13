package database

import (
	"context"
	// #nosec G505 Used only for generating a 160 bit hash, it's not used for security purposes

	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestIntegrationAccessControlStore_SaveExternalServiceRole(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	type run struct {
		cmd     accesscontrol.SaveExternalServiceRoleCommand
		wantErr bool
	}
	tests := []struct {
		name string
		runs []run
	}{
		{
			name: "create app role",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   1,
						ServiceAccountID:  1,
						Permissions: []accesscontrol.Permission{
							{Action: "users:read", Scope: "users:id:1"},
							{Action: "users:read", Scope: "users:id:2"},
						},
					},
					wantErr: false,
				},
			},
		},
		{
			name: "update app role",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   1,
						ServiceAccountID:  1,
						Permissions: []accesscontrol.Permission{
							{Action: "users:read", Scope: "users:id:1"},
							{Action: "users:read", Scope: "users:id:2"},
						},
					},
				},
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   1,
						ServiceAccountID:  1,
						Permissions: []accesscontrol.Permission{
							{Action: "users:write", Scope: "users:id:1"},
							{Action: "users:write", Scope: "users:id:2"},
						},
					},
				},
			},
		},
		{
			name: "edge case - remove all permissions",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   1,
						ServiceAccountID:  1,
						Permissions: []accesscontrol.Permission{
							{Action: "users:read", Scope: "users:id:1"},
							{Action: "users:read", Scope: "users:id:2"},
						},
					},
				},
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   1,
						ServiceAccountID:  1,
						Permissions:       []accesscontrol.Permission{},
					},
				},
			},
		},
		{
			name: "edge case - reassign to another service account",
			runs: []run{
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   1,
						ServiceAccountID:  1,
					},
				},
				{
					cmd: accesscontrol.SaveExternalServiceRoleCommand{
						ExternalServiceID: "app1",
						AssignmentOrgID:   2,
						ServiceAccountID:  2,
					},
					wantErr: false,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			s := &AccessControlStore{
				sql: db.InitTestDB(t),
			}

			for i := range tt.runs {
				err := s.SaveExternalServiceRole(ctx, tt.runs[i].cmd)
				if tt.runs[i].wantErr {
					require.Error(t, err)
					continue
				}
				require.NoError(t, err)

				errDBSession := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
					storedRole, err := getRoleByUID(ctx, sess, accesscontrol.PrefixedRoleUID(extServiceRoleName(tt.runs[i].cmd.ExternalServiceID)))
					require.NoError(t, err)
					require.NotNil(t, storedRole)
					require.True(t, storedRole.Global(), "Incorrect global state of the role")

					storedPerm, err := getRolePermissions(ctx, sess, storedRole.ID)
					require.NoError(t, err)
					for i := range storedPerm {
						storedPerm[i] = accesscontrol.Permission{Action: storedPerm[i].Action, Scope: storedPerm[i].Scope}
					}
					require.ElementsMatch(t, tt.runs[i].cmd.Permissions, storedPerm)

					var assignment accesscontrol.UserRole
					has, err := sess.Where("role_id = ? AND user_id = ?", storedRole.ID, tt.runs[i].cmd.ServiceAccountID).Get(&assignment)
					require.NoError(t, err)
					require.True(t, has)
					require.Equal(t, tt.runs[i].cmd.AssignmentOrgID, assignment.OrgID, "Incorrect OrgID for the role assignment")

					return nil
				})
				require.NoError(t, errDBSession)
			}
		})
	}
}

func TestIntegrationAccessControlStore_DeleteExternalServiceRole(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	extID := "app1"
	tests := []struct {
		name    string
		init    func(t *testing.T, ctx context.Context, s *AccessControlStore)
		id      string
		wantErr bool
	}{
		{
			name:    "delete no role",
			id:      extID,
			wantErr: false,
		},
		{
			name: "delete role",
			init: func(t *testing.T, ctx context.Context, s *AccessControlStore) {
				errSave := s.SaveExternalServiceRole(ctx, accesscontrol.SaveExternalServiceRoleCommand{
					AssignmentOrgID:   2,
					ExternalServiceID: extID,
					ServiceAccountID:  3,
					Permissions: []accesscontrol.Permission{
						{Action: "users:read", Scope: "users:id:1"},
						{Action: "users:write", Scope: "users:id:1"},
					},
				})
				require.NoError(t, errSave)
			},
			id:      extID,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			s := &AccessControlStore{
				sql: db.InitTestDB(t),
			}
			if tt.init != nil {
				tt.init(t, ctx, s)
			}
			roleID := int64(-1)
			err := s.sql.WithDbSession(ctx, func(sess *db.Session) error {
				role, err := getRoleByUID(ctx, sess, accesscontrol.PrefixedRoleUID(extServiceRoleName(tt.id)))
				if err != nil && !errors.Is(err, accesscontrol.ErrRoleNotFound) {
					return err
				}
				if role != nil {
					roleID = role.ID
				}
				return nil
			})
			require.NoError(t, err)
			err = s.DeleteExternalServiceRole(ctx, tt.id)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			// Only check removal if the role existed before
			if roleID == -1 {
				return
			}

			// Assignments should be deleted
			_ = s.sql.WithDbSession(ctx, func(sess *db.Session) error {
				var assignment accesscontrol.UserRole
				count, err := sess.Where("role_id = ?", roleID).Count(&assignment)
				require.NoError(t, err)
				require.Zero(t, count)
				return nil
			})

			// Permissions should be deleted
			_ = s.sql.WithDbSession(ctx, func(sess *db.Session) error {
				var permission accesscontrol.Permission
				count, err := sess.Where("role_id = ?", roleID).Count(&permission)
				require.NoError(t, err)
				require.Zero(t, count)
				return nil
			})

			// Role should be deleted
			_ = s.sql.WithDbSession(ctx, func(sess *db.Session) error {
				storedRole, err := getRoleByUID(ctx, sess, accesscontrol.PrefixedRoleUID(extServiceRoleName(tt.id)))
				require.ErrorIs(t, err, accesscontrol.ErrRoleNotFound)
				require.Nil(t, storedRole)
				return nil
			})
		})
	}
}
