package acimpl

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
	"github.com/grafana/grafana/pkg/services/accesscontrol/permreg"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// setupBenchEnv will create userCount users, userCount managed roles with resourceCount managed permission each
// Example: setupBenchEnv(b, 2, 3):
// - will create 2 users and assign them 2 managed roles
// - each managed role will have 3 permissions {"resources:action2", "resources:id:x"} where x belongs to [1, 3]
func setupBenchEnv(b *testing.B, usersCount, resourceCount int) (accesscontrol.Service, *user.SignedInUser) {
	now := time.Now()
	sqlStore := db.InitTestDB(b)
	store := database.ProvideService(sqlStore)
	acService := &Service{
		cfg:            setting.NewCfg(),
		log:            log.New("accesscontrol-test"),
		registrations:  accesscontrol.RegistrationList{},
		store:          store,
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
		cache:          localcache.New(1*time.Second, 1*time.Second),
		permRegistry:   permreg.ProvidePermissionRegistry(),
		actionResolver: resourcepermissions.NewActionSetService(),
	}

	// Prepare default permissions
	action1 := "resources:action1"
	err := acService.DeclareFixedRoles(accesscontrol.RoleRegistration{
		Role:   accesscontrol.RoleDTO{Name: "fixed:test:role", Permissions: []accesscontrol.Permission{{Action: action1}}},
		Grants: []string{string(org.RoleViewer)},
	})
	require.NoError(b, err)
	err = acService.RegisterFixedRoles(context.Background())
	require.NoError(b, err)

	// Populate users, roles and assignments
	if errInsert := actest.ConcurrentBatch(actest.Concurrency, usersCount, actest.BatchSize, func(start, end int) error {
		n := end - start
		users := make([]user.User, 0, n)
		orgUsers := make([]org.OrgUser, 0, n)
		roles := make([]accesscontrol.Role, 0, n)
		userRoles := make([]accesscontrol.UserRole, 0, n)
		for u := start + 1; u < end+1; u++ {
			users = append(users, user.User{
				ID:      int64(u),
				UID:     fmt.Sprintf("user%v", u),
				Name:    fmt.Sprintf("user%v", u),
				Login:   fmt.Sprintf("user%v", u),
				Email:   fmt.Sprintf("user%v@example.org", u),
				Created: now,
				Updated: now,
			})
			orgUsers = append(orgUsers, org.OrgUser{
				ID:      int64(u),
				UserID:  int64(u),
				OrgID:   1,
				Role:    org.RoleViewer,
				Created: now,
				Updated: now,
			})
			roles = append(roles, accesscontrol.Role{
				ID:      int64(u),
				UID:     fmt.Sprintf("managed_users_%v_permissions", u),
				Name:    fmt.Sprintf("managed:users:%v:permissions", u),
				OrgID:   1,
				Version: 1,
				Created: now,
				Updated: now,
			})
			userRoles = append(userRoles, accesscontrol.UserRole{
				ID:      int64(u),
				OrgID:   1,
				RoleID:  int64(u),
				UserID:  int64(u),
				Created: now,
			})
		}
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			if _, err := sess.Insert(users); err != nil {
				return err
			}
			if _, err := sess.Insert(orgUsers); err != nil {
				return err
			}
			if _, err := sess.Insert(roles); err != nil {
				return err
			}
			_, err := sess.Insert(userRoles)
			return err
		})
		return err
	}); errInsert != nil {
		require.NoError(b, errInsert, "could not insert users and roles")
		return nil, nil
	}

	// Populate permissions
	action2 := "resources:action2"
	if errInsert := actest.ConcurrentBatch(actest.Concurrency, resourceCount*usersCount, actest.BatchSize, func(start, end int) error {
		permissions := make([]accesscontrol.Permission, 0, end-start)
		for i := start; i < end; i++ {
			permissions = append(permissions, accesscontrol.Permission{
				RoleID:  int64(i/resourceCount + 1),
				Action:  action2,
				Scope:   fmt.Sprintf("resources:id:%v", i%resourceCount+1),
				Created: now,
				Updated: now,
			})
		}

		return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(permissions)
			return err
		})
	}); errInsert != nil {
		require.NoError(b, errInsert, "could not insert permissions")
		return nil, nil
	}

	// Allow signed in user to view all users permissions in the worst way
	userPermissions := map[string][]string{}
	for u := 1; u < usersCount+1; u++ {
		userPermissions[accesscontrol.ActionUsersPermissionsRead] =
			append(userPermissions[accesscontrol.ActionUsersPermissionsRead], fmt.Sprintf("users:id:%v", u))
	}
	return acService, &user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: userPermissions}}
}

func benchSearchUsersWithActionPrefix(b *testing.B, usersCount, resourceCount int) {
	acService, siu := setupBenchEnv(b, usersCount, resourceCount)
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		usersPermissions, err := acService.SearchUsersPermissions(context.Background(), siu, accesscontrol.SearchOptions{ActionPrefix: "resources:"})
		require.NoError(b, err)
		require.Len(b, usersPermissions, usersCount)
		for _, permissions := range usersPermissions {
			// action1 on all resource + action2
			require.Len(b, permissions, resourceCount+1)
		}
	}
}

// Lots of resources
func BenchmarkSearchUsersWithActionPrefix_10_1K(b *testing.B) {
	benchSearchUsersWithActionPrefix(b, 10, 1000)
} // ~0.047s/op
func BenchmarkSearchUsersWithActionPrefix_10_10K(b *testing.B) {
	benchSearchUsersWithActionPrefix(b, 10, 10000)
} // ~0.5s/op
func BenchmarkSearchUsersWithActionPrefix_10_100K(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchSearchUsersWithActionPrefix(b, 10, 100000)
} // ~4.6s/op
func BenchmarkSearchUsersWithActionPrefix_10_1M(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchSearchUsersWithActionPrefix(b, 10, 1000000)
} // ~55.36s/op

// Lots of users (most probable case)
func BenchmarkSearchUsersWithActionPrefix_1K_10(b *testing.B) {
	benchSearchUsersWithActionPrefix(b, 1000, 10)
} // ~0.056s/op
func BenchmarkSearchUsersWithActionPrefix_10K_10(b *testing.B) {
	benchSearchUsersWithActionPrefix(b, 10000, 10)
} // ~0.58s/op
func BenchmarkSearchUsersWithActionPrefix_100K_10(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchSearchUsersWithActionPrefix(b, 100000, 10)
} // ~6.21s/op
func BenchmarkSearchUsersWithActionPrefix_1M_10(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchSearchUsersWithActionPrefix(b, 1000000, 10)
} // ~57s/op

// Lots of both

func BenchmarkSearchUsersWithActionPrefix_1K_1K(b *testing.B) {
	benchSearchUsersWithActionPrefix(b, 1000, 1000)
}

func BenchmarkSearchUsersWithActionPrefix_10K_100(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchSearchUsersWithActionPrefix(b, 10000, 100)
} // ~1.45s/op
func BenchmarkSearchUsersWithActionPrefix_10K_1K(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchSearchUsersWithActionPrefix(b, 10000, 1000)
} // ~50s/op

// Benchmarking search when we specify Action and Scope
func benchSearchUsersWithPerm(b *testing.B, usersCount, resourceCount int) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	acService, siu := setupBenchEnv(b, usersCount, resourceCount)
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		usersPermissions, err := acService.SearchUsersPermissions(context.Background(), siu,
			accesscontrol.SearchOptions{Action: "resources:action2", Scope: "resources:id:1"})
		require.NoError(b, err)
		require.Len(b, usersPermissions, usersCount)
		for _, permissions := range usersPermissions {
			require.Len(b, permissions, 1)
		}
	}
}

func BenchmarkSearchUsersWithPerm_1K_10(b *testing.B)   { benchSearchUsersWithPerm(b, 1000, 10) }     // ~0.045s/op
func BenchmarkSearchUsersWithPerm_1K_100(b *testing.B)  { benchSearchUsersWithPerm(b, 1000, 100) }    // ~0.038s/op
func BenchmarkSearchUsersWithPerm_1K_1K(b *testing.B)   { benchSearchUsersWithPerm(b, 1000, 1000) }   // ~0.033s/op
func BenchmarkSearchUsersWithPerm_1K_10K(b *testing.B)  { benchSearchUsersWithPerm(b, 1000, 10000) }  // ~0.033s/op
func BenchmarkSearchUsersWithPerm_1K_100K(b *testing.B) { benchSearchUsersWithPerm(b, 1000, 100000) } // ~0.056s/op

func BenchmarkSearchUsersWithPerm_10K_10(b *testing.B)  { benchSearchUsersWithPerm(b, 10000, 10) }    // ~0.11s/op
func BenchmarkSearchUsersWithPerm_10K_100(b *testing.B) { benchSearchUsersWithPerm(b, 10000, 100) }   // ~0.12s/op
func BenchmarkSearchUsersWithPerm_10K_1K(b *testing.B)  { benchSearchUsersWithPerm(b, 10000, 1000) }  // ~0.12s/op
func BenchmarkSearchUsersWithPerm_10K_10K(b *testing.B) { benchSearchUsersWithPerm(b, 10000, 10000) } // ~0.17s/op

func BenchmarkSearchUsersWithPerm_20K_10(b *testing.B)  { benchSearchUsersWithPerm(b, 20000, 10) }    // ~0.22s/op
func BenchmarkSearchUsersWithPerm_20K_100(b *testing.B) { benchSearchUsersWithPerm(b, 20000, 100) }   // ~0.22s/op
func BenchmarkSearchUsersWithPerm_20K_1K(b *testing.B)  { benchSearchUsersWithPerm(b, 20000, 1000) }  // ~0.25s/op
func BenchmarkSearchUsersWithPerm_20K_10K(b *testing.B) { benchSearchUsersWithPerm(b, 20000, 10000) } // ~s/op

func BenchmarkSearchUsersWithPerm_100K_10(b *testing.B)  { benchSearchUsersWithPerm(b, 100000, 10) }  // ~0.88s/op
func BenchmarkSearchUsersWithPerm_100K_100(b *testing.B) { benchSearchUsersWithPerm(b, 100000, 100) } // ~0.72s/op

// Benchmarking search when we specify Action and Scope
func benchSearchUserWithAction(b *testing.B, usersCount, resourceCount int) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	acService, siu := setupBenchEnv(b, usersCount, resourceCount)
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		usersPermissions, err := acService.SearchUsersPermissions(context.Background(), siu,
			accesscontrol.SearchOptions{Action: "resources:action2", UserID: 14})
		require.NoError(b, err)
		require.Len(b, usersPermissions, 1)
		for _, permissions := range usersPermissions {
			require.Len(b, permissions, resourceCount)
		}
	}
}

func BenchmarkSearchUserWithAction_1K_1k(b *testing.B) { benchSearchUserWithAction(b, 1000, 1000) } // ~0.6s/op (mysql)

// setupBenchManyTeams creates a single user assigned to teamCount teams, each team having one
// managed role with a datasource:query permission. This mirrors the customer scenario where a
// user belongs to many LDAP/SAML groups mapped to Grafana teams, and each team grants access
// to a specific datasource.
func setupBenchManyTeams(b *testing.B, teamCount int) (*Service, *user.SignedInUser) {
	b.Helper()
	now := time.Now()
	sqlStore := db.InitTestDB(b)
	store := database.ProvideService(sqlStore)
	cfg := setting.NewCfg()
	cfg.RBAC.PermissionCache = true
	acService := &Service{
		cfg:            cfg,
		features:       featuremgmt.WithFeatures(),
		log:            log.New("accesscontrol-bench"),
		registrations:  accesscontrol.RegistrationList{},
		store:          store,
		roles:          accesscontrol.BuildBasicRoleDefinitions(),
		cache:          localcache.New(cacheTTL, cacheTTL),
		permRegistry:   permreg.ProvidePermissionRegistry(),
		actionResolver: resourcepermissions.NewActionSetService(),
	}
	require.NoError(b, acService.RegisterFixedRoles(context.Background()))

	userID := int64(1)
	require.NoError(b, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		if _, err := sess.Insert(user.User{
			ID: userID, UID: "user1", Name: "user1",
			Login: "user1", Email: "user1@example.org",
			Created: now, Updated: now,
		}); err != nil {
			return err
		}
		_, err := sess.Insert(org.OrgUser{
			ID: userID, UserID: userID, OrgID: 1,
			Role: org.RoleViewer, Created: now, Updated: now,
		})
		return err
	}))

	teamIDs := make([]int64, teamCount)
	roles := make([]accesscontrol.Role, teamCount)
	teamRoles := make([]accesscontrol.TeamRole, teamCount)
	permissions := make([]accesscontrol.Permission, teamCount)
	for i := 0; i < teamCount; i++ {
		teamIDs[i] = int64(i + 1)
		roles[i] = accesscontrol.Role{
			ID: teamIDs[i], UID: fmt.Sprintf("managed_teams_%d_permissions", teamIDs[i]),
			Name:  fmt.Sprintf("managed:teams:%d:permissions", teamIDs[i]),
			OrgID: 1, Version: 1, Created: now, Updated: now,
		}
		teamRoles[i] = accesscontrol.TeamRole{
			OrgID: 1, RoleID: teamIDs[i], TeamID: teamIDs[i], Created: now,
		}
		permissions[i] = accesscontrol.Permission{
			RoleID:  teamIDs[i],
			Action:  "datasources:query",
			Scope:   fmt.Sprintf("datasources:uid:ds-%d", teamIDs[i]),
			Created: now, Updated: now,
		}
	}

	require.NoError(b, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		if _, err := sess.Insert(roles); err != nil {
			return err
		}
		if _, err := sess.Insert(teamRoles); err != nil {
			return err
		}
		_, err := sess.Insert(permissions)
		return err
	}))

	signedInUser := &user.SignedInUser{
		UserID:  userID,
		OrgID:   1,
		OrgRole: org.RoleViewer,
		TeamIDs: teamIDs,
	}

	return acService, signedInUser
}

// benchGetUserPermissionsManyTeamsConcurrent measures the cost of N goroutines concurrently
// calling GetUserPermissions for the same user who belongs to many teams — the thundering
// herd scenario triggered by 800 parallel datasource buildinfo proxy requests on alert rule
// creation. The cache is flushed before each iteration to simulate expiry.
func benchGetUserPermissionsManyTeamsConcurrent(b *testing.B, teamCount, concurrency int) {
	b.Helper()
	acService, signedInUser := setupBenchManyTeams(b, teamCount)

	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		// Flush all sub-caches to simulate the moment the TTL expires and all
		// concurrent requests arrive simultaneously with a cold cache.
		acService.cache = localcache.New(cacheTTL, cacheTTL)

		var wg sync.WaitGroup
		wg.Add(concurrency)
		for i := 0; i < concurrency; i++ {
			go func() {
				defer wg.Done()
				_, err := acService.GetUserPermissions(context.Background(), signedInUser, accesscontrol.Options{})
				require.NoError(b, err)
			}()
		}
		wg.Wait()
	}
}

// Realistic customer scale: ~100–200 teams, 100–800 concurrent requests.
// 800 concurrent matches the number of Prometheus datasource buildinfo calls fired
// simultaneously when creating an alert rule (customer had ~800 Prometheus datasources).
func BenchmarkGetUserPermissions_ManyTeams_100teams_1concurrent(b *testing.B) {
	benchGetUserPermissionsManyTeamsConcurrent(b, 100, 1)
}
func BenchmarkGetUserPermissions_ManyTeams_100teams_100concurrent(b *testing.B) {
	benchGetUserPermissionsManyTeamsConcurrent(b, 100, 100)
}
func BenchmarkGetUserPermissions_ManyTeams_100teams_800concurrent(b *testing.B) {
	benchGetUserPermissionsManyTeamsConcurrent(b, 100, 800)
}
func BenchmarkGetUserPermissions_ManyTeams_200teams_100concurrent(b *testing.B) {
	benchGetUserPermissionsManyTeamsConcurrent(b, 200, 100)
}
func BenchmarkGetUserPermissions_ManyTeams_200teams_800concurrent(b *testing.B) {
	benchGetUserPermissionsManyTeamsConcurrent(b, 200, 800)
}
