package resourcepermissions

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourcesService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
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

func getDSPermissions(b *testing.B, store *store, dataSources []int64) {
	dsId := dataSources[0]

	permissions, err := store.GetResourcePermissions(context.Background(), accesscontrol.GlobalOrgID, GetResourcePermissionsQuery{
		User:              &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: {"org.users:read": {"users:*"}, "teams:read": {"teams:*"}}}},
		Actions:           []string{dsAction},
		Resource:          dsResource,
		ResourceID:        strconv.Itoa(int(dsId)),
		ResourceAttribute: "id",
	})
	require.NoError(b, err)
	assert.GreaterOrEqual(b, len(permissions), 2)
}

func setupResourceBenchmark(b *testing.B, dsNum, usersNum int) (*store, []int64) {
	ac, sql := setupTestEnv(b)
	dataSources := GenerateDatasourcePermissions(b, sql, ac, dsNum, usersNum, permissionsPerDs)
	return ac, dataSources
}

func GenerateDatasourcePermissions(b *testing.B, db *sqlstore.SQLStore, ac *store, dsNum, usersNum, permissionsPerDs int) []int64 {
	dataSources := make([]int64, 0)
	for i := 0; i < dsNum; i++ {
		addDSCommand := &datasources.AddDataSourceCommand{
			OrgID:  0,
			Name:   fmt.Sprintf("ds_%d", i),
			Type:   datasources.DS_GRAPHITE,
			Access: datasources.DS_ACCESS_DIRECT,
			URL:    "http://test",
		}
		dsStore := datasourcesService.CreateStore(db, log.New("publicdashboards.test"))
		dataSource, _ := dsStore.AddDataSource(context.Background(), addDSCommand)
		dataSources = append(dataSources, dataSource.ID)
	}

	userIds, teamIds := generateTeamsAndUsers(b, db, usersNum)

	for _, dsID := range dataSources {
		// Add DS permissions for the users
		maxPermissions := int(math.Min(float64(permissionsPerDs), float64(len(userIds))))
		for i := 0; i < maxPermissions; i++ {
			_, err := ac.SetUserResourcePermission(
				context.Background(),
				accesscontrol.GlobalOrgID,
				accesscontrol.User{ID: userIds[i]},
				SetResourcePermissionCommand{
					Actions:           []string{dsAction},
					Resource:          dsResource,
					ResourceID:        strconv.Itoa(int(dsID)),
					ResourceAttribute: "id",
				},
				nil,
			)
			require.NoError(b, err)
		}

		// Add DS permissions for the teams
		maxPermissions = int(math.Min(float64(permissionsPerDs), float64(len(teamIds))))
		for i := 0; i < maxPermissions; i++ {
			_, err := ac.SetTeamResourcePermission(
				context.Background(),
				accesscontrol.GlobalOrgID,
				teamIds[i],
				SetResourcePermissionCommand{
					Actions:           []string{"datasources:query"},
					Resource:          "datasources",
					ResourceID:        strconv.Itoa(int(dsID)),
					ResourceAttribute: "id",
				},
				nil,
			)
			require.NoError(b, err)
		}
	}

	return dataSources
}

func generateTeamsAndUsers(b *testing.B, db *sqlstore.SQLStore, users int) ([]int64, []int64) {
	teamSvc := teamimpl.ProvideService(db, db.Cfg)
	numberOfTeams := int(math.Ceil(float64(users) / UsersPerTeam))
	globalUserId := 0
	qs := quotatest.New(false, nil)
	orgSvc, err := orgimpl.ProvideService(db, db.Cfg, qs)
	require.NoError(b, err)
	usrSvc, err := userimpl.ProvideService(db, orgSvc, db.Cfg, nil, nil, qs, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService())
	require.NoError(b, err)
	userIds := make([]int64, 0)
	teamIds := make([]int64, 0)
	for i := 0; i < numberOfTeams; i++ {
		// Create team
		teamName := fmt.Sprintf("%s%v", "team", i)
		teamEmail := fmt.Sprintf("%s@example.org", teamName)
		team, err := teamSvc.CreateTeam(teamName, teamEmail, 1)
		require.NoError(b, err)
		teamId := team.ID
		teamIds = append(teamIds, teamId)

		// Create team users
		for u := 0; u < UsersPerTeam; u++ {
			userName := fmt.Sprintf("%s%v", "user", globalUserId)
			userEmail := fmt.Sprintf("%s@example.org", userName)
			createUserCmd := user.CreateUserCommand{Email: userEmail, Name: userName, Login: userName, OrgID: 1}

			user, err := usrSvc.Create(context.Background(), &createUserCmd)
			require.NoError(b, err)
			userId := user.ID
			globalUserId++
			userIds = append(userIds, userId)

			err = teamSvc.AddTeamMember(userId, 1, teamId, false, 1)
			require.NoError(b, err)
		}
	}

	return userIds, teamIds
}
