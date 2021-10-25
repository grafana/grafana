package database

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const (
	dsAction           = "datasources:query"
	dsResource         = "datasources"
	PermissionsPerRole = 10
	UsersPerTeam       = 10
	permissionsPerDs   = 100
)

func BenchmarkDSPermissions10_10(b *testing.B) { benchmarkDSPermissions(b, 10, 10) }

func BenchmarkDSPermissions10_100(b *testing.B) { benchmarkDSPermissions(b, 10, 100) }

func BenchmarkDSPermissions10_1000(b *testing.B) { benchmarkDSPermissions(b, 10, 1000) }

func BenchmarkDSPermissions100_10(b *testing.B) { benchmarkDSPermissions(b, 100, 10) }

func BenchmarkDSPermissions100_100(b *testing.B) { benchmarkDSPermissions(b, 100, 100) }

func BenchmarkDSPermissions100_1000(b *testing.B) { benchmarkDSPermissions(b, 100, 1000) }

func BenchmarkDSPermissions1000_10(b *testing.B) { benchmarkDSPermissions(b, 1000, 10) }

func BenchmarkDSPermissions1000_100(b *testing.B) { benchmarkDSPermissions(b, 1000, 100) }

func BenchmarkDSPermissions1000_1000(b *testing.B) { benchmarkDSPermissions(b, 1000, 1000) }

func benchmarkDSPermissions(b *testing.B, dsNum, usersNum int) {
	ac, dataSources := setupResourceBenchmark(b, dsNum, usersNum)
	// We don't want to measure DB initialization
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		getDSPermissions(b, ac, dataSources)
	}
}

func getDSPermissions(b *testing.B, store accesscontrol.ResourceStore, dataSources []int64) {
	dsId := dataSources[0]

	permissions, err := store.GetResourcesPermissions(context.Background(), accesscontrol.GlobalOrgID, accesscontrol.GetResourcesPermissionsQuery{
		Actions:     []string{dsAction},
		Resource:    dsResource,
		ResourceIDs: []string{strconv.Itoa(int(dsId))},
	})
	require.NoError(b, err)
	assert.GreaterOrEqual(b, len(permissions), 2)
}

func setupResourceBenchmark(b *testing.B, dsNum, usersNum int) (*AccessControlStore, []int64) {
	ac, sql := setupTestEnv(b)
	dataSources := GenerateDatasourcePermissions(b, sql, ac, dsNum, usersNum, permissionsPerDs)
	return ac, dataSources
}

func GenerateDatasourcePermissions(b *testing.B, db *sqlstore.SQLStore, ac *AccessControlStore, dsNum, usersNum, permissionsPerDs int) []int64 {
	dataSources := make([]int64, 0)
	for i := 0; i < dsNum; i++ {
		addDSCommand := &models.AddDataSourceCommand{
			OrgId:  0,
			Name:   fmt.Sprintf("ds_%d", i),
			Type:   models.DS_GRAPHITE,
			Access: models.DS_ACCESS_DIRECT,
			Url:    "http://test",
		}

		_ = db.AddDataSource(context.Background(), addDSCommand)
		dataSources = append(dataSources, addDSCommand.Result.Id)
	}

	userIds, teamIds := generateTeamsAndUsers(b, db, usersNum)

	for _, dsID := range dataSources {
		// Add DS permissions for the users
		maxPermissions := int(math.Min(float64(permissionsPerDs), float64(len(userIds))))
		for i := 0; i < maxPermissions; i++ {
			_, err := ac.SetUserResourcePermissions(
				context.Background(),
				accesscontrol.GlobalOrgID,
				userIds[i],
				accesscontrol.SetResourcePermissionsCommand{
					Actions:    []string{dsAction},
					Resource:   dsResource,
					ResourceID: strconv.Itoa(int(dsID)),
				},
			)
			require.NoError(b, err)
		}

		// Add DS permissions for the teams
		maxPermissions = int(math.Min(float64(permissionsPerDs), float64(len(teamIds))))
		for i := 0; i < maxPermissions; i++ {
			_, err := ac.SetTeamResourcePermissions(
				context.Background(),
				accesscontrol.GlobalOrgID,
				teamIds[i],
				accesscontrol.SetResourcePermissionsCommand{
					Actions:    []string{"datasources:query"},
					Resource:   "datasources",
					ResourceID: strconv.Itoa(int(dsID)),
				},
			)
			require.NoError(b, err)
		}
	}

	return dataSources
}

func generateTeamsAndUsers(b *testing.B, db *sqlstore.SQLStore, users int) ([]int64, []int64) {
	numberOfTeams := int(math.Ceil(float64(users) / UsersPerTeam))
	globalUserId := 0

	userIds := make([]int64, 0)
	teamIds := make([]int64, 0)
	for i := 0; i < numberOfTeams; i++ {
		// Create team
		teamName := fmt.Sprintf("%s%v", "team", i)
		teamEmail := fmt.Sprintf("%s@example.org", teamName)
		team, err := db.CreateTeam(teamName, teamEmail, 1)
		require.NoError(b, err)
		teamId := team.Id
		teamIds = append(teamIds, teamId)

		// Create team users
		for u := 0; u < UsersPerTeam; u++ {
			userName := fmt.Sprintf("%s%v", "user", globalUserId)
			userEmail := fmt.Sprintf("%s@example.org", userName)
			createUserCmd := models.CreateUserCommand{Email: userEmail, Name: userName, Login: userName, OrgId: 1}

			user, err := db.CreateUser(context.Background(), createUserCmd)
			require.NoError(b, err)
			userId := user.Id
			globalUserId++
			userIds = append(userIds, userId)

			err = db.AddTeamMember(userId, 1, teamId, false, 1)
			require.NoError(b, err)
		}
	}

	return userIds, teamIds
}
