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
	usernamePrefix       = "user"
	teamPrefix           = "team"
	PermissionsPerPolicy = 10
	UsersPerTeam         = 10
)

func GeneratePolicies(b *testing.B, ac accesscontrol.Store, policiesPerUser, users int) {
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

		// Create team policies
		for j := 0; j < policiesPerUser; j++ {
			policyName := fmt.Sprintf("policy_%s_%v", teamName, j)
			createPolicyCmd := accesscontrol.CreatePolicyCommand{OrgId: 1, Name: policyName}
			res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
			require.NoError(b, err)
			policyId := res.Id

			for k := 0; k < PermissionsPerPolicy; k++ {
				permission := fmt.Sprintf("permission_%v", k)
				scope := fmt.Sprintf("scope_%v", k)
				permCmd := accesscontrol.CreatePermissionCommand{
					PolicyId:   policyId,
					Permission: permission,
					Scope:      scope,
				}

				_, err := ac.CreatePermission(context.Background(), permCmd)
				require.NoError(b, err)
			}

			addTeamPolicyCmd := accesscontrol.AddTeamPolicyCommand{
				OrgId:    1,
				PolicyId: policyId,
				TeamId:   teamId,
			}
			err = ac.AddTeamPolicy(&addTeamPolicyCmd)
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

			// Create user policies
			for j := 0; j < policiesPerUser; j++ {
				policyName := fmt.Sprintf("policy_%s_%v", userName, j)
				createPolicyCmd := accesscontrol.CreatePolicyCommand{OrgId: 1, Name: policyName}
				res, err := ac.CreatePolicy(context.Background(), createPolicyCmd)
				require.NoError(b, err)
				policyId := res.Id

				for k := 0; k < PermissionsPerPolicy; k++ {
					permission := fmt.Sprintf("permission_%v", k)
					scope := fmt.Sprintf("scope_%v", k)
					permCmd := accesscontrol.CreatePermissionCommand{
						PolicyId:   policyId,
						Permission: permission,
						Scope:      scope,
					}

					_, err := ac.CreatePermission(context.Background(), permCmd)
					require.NoError(b, err)
				}

				addUserPolicyCmd := accesscontrol.AddUserPolicyCommand{
					OrgId:    1,
					PolicyId: policyId,
					UserId:   userId,
				}
				err = ac.AddUserPolicy(&addUserPolicyCmd)
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
