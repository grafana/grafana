package testing

import (
	"context"
	"fmt"
	"math"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const (
	usernamePrefix     = "user"
	teamPrefix         = "team"
	PermissionsPerRole = 10
	UsersPerTeam       = 10
)

func GenerateRoles(b *testing.B, db *sqlstore.SQLStore, ac accesscontrol.Store, rolesPerUser, users int) {
	numberOfTeams := int(math.Ceil(float64(users) / UsersPerTeam))
	globalUserId := 0
	for i := 0; i < numberOfTeams; i++ {
		// Create team
		teamName := fmt.Sprintf("%s%v", teamPrefix, i)
		teamEmail := fmt.Sprintf("%s@test.com", teamName)
		team, err := db.CreateTeam(teamName, teamEmail, 1)
		require.NoError(b, err)
		teamId := team.Id

		// Create team roles
		for j := 0; j < rolesPerUser; j++ {
			roleName := fmt.Sprintf("role_%s_%v", teamName, j)
			createRoleCmd := accesscontrol.CreateRoleCommand{OrgID: 1, Name: roleName}
			role, err := ac.CreateRole(context.Background(), createRoleCmd)
			require.NoError(b, err)

			for k := 0; k < PermissionsPerRole; k++ {
				permission := fmt.Sprintf("permission_%v", k)
				scope := fmt.Sprintf("scope_%v", k)
				permCmd := accesscontrol.CreatePermissionCommand{
					RoleID:     role.ID,
					Permission: permission,
					Scope:      scope,
				}

				_, err := ac.CreatePermission(context.Background(), permCmd)
				require.NoError(b, err)
			}

			addTeamRoleCmd := accesscontrol.AddTeamRoleCommand{
				OrgID:   1,
				RoleUID: role.UID,
				TeamID:  teamId,
			}
			err = ac.AddTeamRole(&addTeamRoleCmd)
			require.NoError(b, err)
		}

		// Create team users
		for u := 0; u < UsersPerTeam; u++ {
			userName := fmt.Sprintf("%s%v", usernamePrefix, globalUserId)
			userEmail := fmt.Sprintf("%s@test.com", userName)
			createUserCmd := models.CreateUserCommand{Email: userEmail, Name: userName, Login: userName, OrgId: 1}

			user, err := db.CreateUser(context.Background(), createUserCmd)
			require.NoError(b, err)
			userId := user.Id
			globalUserId++

			// Create user roles
			for j := 0; j < rolesPerUser; j++ {
				roleName := fmt.Sprintf("role_%s_%v", userName, j)
				createRoleCmd := accesscontrol.CreateRoleCommand{OrgID: 1, Name: roleName}
				role, err := ac.CreateRole(context.Background(), createRoleCmd)
				require.NoError(b, err)

				for k := 0; k < PermissionsPerRole; k++ {
					permission := fmt.Sprintf("permission_%v", k)
					scope := fmt.Sprintf("scope_%v", k)
					permCmd := accesscontrol.CreatePermissionCommand{
						RoleID:     role.ID,
						Permission: permission,
						Scope:      scope,
					}

					_, err := ac.CreatePermission(context.Background(), permCmd)
					require.NoError(b, err)
				}

				addUserRoleCmd := accesscontrol.AddUserRoleCommand{
					OrgID:   1,
					RoleUID: role.UID,
					UserID:  userId,
				}
				err = ac.AddUserRole(&addUserRoleCmd)
				require.NoError(b, err)
			}

			err = db.AddTeamMember(userId, 1, teamId, false, 1)
			require.NoError(b, err)
		}
	}
}
