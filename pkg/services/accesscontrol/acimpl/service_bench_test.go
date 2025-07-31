package acimpl

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/accesscontrol/database"
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
		settingsProvider: setting.ProvideService(setting.NewCfg()),
		log:              log.New("accesscontrol-test"),
		registrations:    accesscontrol.RegistrationList{},
		store:            store,
		roles:            accesscontrol.BuildBasicRoleDefinitions(),
		cache:            localcache.New(1*time.Second, 1*time.Second),
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
		userPermissions[accesscontrol.ActionUsersPermissionsRead] = append(userPermissions[accesscontrol.ActionUsersPermissionsRead], fmt.Sprintf("users:id:%v", u))
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
