package testing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type RoleTestCase struct {
	Name        string
	UID         string
	Permissions []PermissionTestCase
}

type PermissionTestCase struct {
	Permission string
	Scope      string
}

func CreateRole(t *testing.T, ac accesscontrol.Store, p RoleTestCase) *accesscontrol.RoleDTO {
	createRoleCmd := accesscontrol.CreateRoleWithPermissionsCommand{
		OrgID:       1,
		UID:         p.UID,
		Name:        p.Name,
		Permissions: []accesscontrol.Permission{},
	}
	for _, perm := range p.Permissions {
		createRoleCmd.Permissions = append(createRoleCmd.Permissions, accesscontrol.Permission{
			Permission: perm.Permission,
			Scope:      perm.Scope,
		})
	}

	res, err := ac.CreateRoleWithPermissions(context.Background(), createRoleCmd)
	require.NoError(t, err)

	return res
}

func CreateUserWithRole(t *testing.T, db *sqlstore.SQLStore, ac accesscontrol.Store, user string, roles []RoleTestCase) {
	createUserCmd := models.CreateUserCommand{
		Email: user + "@test.com",
		Name:  user,
		Login: user,
		OrgId: 1,
	}

	u, err := db.CreateUser(context.Background(), createUserCmd)
	require.NoError(t, err)
	userId := u.Id

	for _, p := range roles {
		createRoleCmd := accesscontrol.CreateRoleCommand{
			OrgID: 1,
			Name:  p.Name,
		}
		role, err := ac.CreateRole(context.Background(), createRoleCmd)
		require.NoError(t, err)

		for _, perm := range p.Permissions {
			permCmd := accesscontrol.CreatePermissionCommand{
				RoleID:     role.ID,
				Permission: perm.Permission,
				Scope:      perm.Scope,
			}

			_, err := ac.CreatePermission(context.Background(), permCmd)
			require.NoError(t, err)
		}

		addUserRoleCmd := accesscontrol.AddUserRoleCommand{
			OrgID:   1,
			RoleUID: role.UID,
			UserID:  userId,
		}
		err = ac.AddUserRole(&addUserRoleCmd)
		require.NoError(t, err)
	}
}

func CreateTeamWithRole(t *testing.T, db *sqlstore.SQLStore, ac accesscontrol.Store, teamname string, roles []RoleTestCase) {
	email, orgID := teamname+"@test.com", int64(1)
	team, err := db.CreateTeam(teamname, email, orgID)
	require.NoError(t, err)
	teamId := team.Id

	for _, p := range roles {
		createRoleCmd := accesscontrol.CreateRoleCommand{
			OrgID: orgID,
			Name:  p.Name,
		}
		role, err := ac.CreateRole(context.Background(), createRoleCmd)
		require.NoError(t, err)

		for _, perm := range p.Permissions {
			permCmd := accesscontrol.CreatePermissionCommand{
				RoleID:     role.ID,
				Permission: perm.Permission,
				Scope:      perm.Scope,
			}

			_, err := ac.CreatePermission(context.Background(), permCmd)
			require.NoError(t, err)
		}

		addTeamRoleCmd := accesscontrol.AddTeamRoleCommand{
			OrgID:   1,
			RoleUID: role.UID,
			TeamID:  teamId,
		}
		err = ac.AddTeamRole(&addTeamRoleCmd)
		require.NoError(t, err)
	}
}
