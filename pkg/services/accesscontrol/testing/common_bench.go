package testing

import (
	"context"
	"fmt"
	"math"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

const (
	usernamePrefix     = "user"
	teamPrefix         = "team"
	PermissionsPerRole = 10
	UsersPerTeam       = 10
)

func GenerateRoles(b *testing.B, ac accesscontrol.Store, rolesPerUser, users int) {
	numberOfTeams := int(math.Ceil(float64(users) / UsersPerTeam))
	globalUserId := 0
	for i := 0; i < numberOfTeams; i++ {
		// Create team
		teamName := fmt.Sprintf("%s%v", teamPrefix, i)
		teamEmail := fmt.Sprintf("%s@test.com", teamName)
		createTeamCmd := models.CreateTeamCommand{OrgId: 1, Name: teamName, Email: teamEmail}
		err := sqlstore.CreateTeam(&createTeamCmd)
		require.NoError(b, err)
		teamId := createTeamCmd.Result.Id

		// Create team roles
		for j := 0; j < rolesPerUser; j++ {
			roleName := fmt.Sprintf("role_%s_%v", teamName, j)
			createRoleCmd := accesscontrol.CreateRoleCommand{OrgId: 1, Name: roleName}
			res, err := ac.CreateRole(context.Background(), createRoleCmd)
			require.NoError(b, err)
			roleId := res.Id

			for k := 0; k < PermissionsPerRole; k++ {
				permission := fmt.Sprintf("permission_%v", k)
				scope := fmt.Sprintf("scope_%v", k)
				permCmd := accesscontrol.CreatePermissionCommand{
					RoleId:     roleId,
					Permission: permission,
					Scope:      scope,
				}

				_, err := ac.CreatePermission(context.Background(), permCmd)
				require.NoError(b, err)
			}

			addTeamRoleCmd := accesscontrol.AddTeamRoleCommand{
				OrgId:  1,
				RoleId: roleId,
				TeamId: teamId,
			}
			err = ac.AddTeamRole(&addTeamRoleCmd)
			require.NoError(b, err)
		}

		// Create team users
		for u := 0; u < UsersPerTeam; u++ {
			userName := fmt.Sprintf("%s%v", usernamePrefix, globalUserId)
			userEmail := fmt.Sprintf("%s@test.com", userName)
			createUserCmd := models.CreateUserCommand{Email: userEmail, Name: userName, Login: userName, OrgId: 1}

			err := sqlstore.CreateUser(context.Background(), &createUserCmd)
			require.NoError(b, err)
			userId := createUserCmd.Result.Id
			globalUserId++

			// Create user roles
			for j := 0; j < rolesPerUser; j++ {
				roleName := fmt.Sprintf("role_%s_%v", userName, j)
				createRoleCmd := accesscontrol.CreateRoleCommand{OrgId: 1, Name: roleName}
				res, err := ac.CreateRole(context.Background(), createRoleCmd)
				require.NoError(b, err)
				roleId := res.Id

				for k := 0; k < PermissionsPerRole; k++ {
					permission := fmt.Sprintf("permission_%v", k)
					scope := fmt.Sprintf("scope_%v", k)
					permCmd := accesscontrol.CreatePermissionCommand{
						RoleId:     roleId,
						Permission: permission,
						Scope:      scope,
					}

					_, err := ac.CreatePermission(context.Background(), permCmd)
					require.NoError(b, err)
				}

				addUserRoleCmd := accesscontrol.AddUserRoleCommand{
					OrgId:  1,
					RoleId: roleId,
					UserId: userId,
				}
				err = ac.AddUserRole(&addUserRoleCmd)
				require.NoError(b, err)
			}

			addTeamMemberCmd := models.AddTeamMemberCommand{
				OrgId:  1,
				UserId: userId,
				TeamId: teamId,
			}
			err = sqlstore.AddTeamMember(&addTeamMemberCmd)
			require.NoError(b, err)
		}
	}
}
