package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	actesting "github.com/grafana/grafana/pkg/services/accesscontrol/testing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func setup(b *testing.B, rolesPerUser, users int) *accessControlStoreTestImpl {
	ac := setupTestEnv(b)
	b.Cleanup(registry.ClearOverrides)
	actesting.GenerateRoles(b, ac.SQLStore, ac, rolesPerUser, users)
	return ac
}

func getRoles(b *testing.B, ac accesscontrol.Store, rolesPerUser, users int) {
	userQuery := models.GetUserByLoginQuery{
		LoginOrEmail: "user1@test.com",
	}
	err := sqlstore.GetUserByLogin(&userQuery)
	require.NoError(b, err)
	userId := userQuery.Result.Id

	userPermissionsQuery := accesscontrol.GetUserPermissionsQuery{OrgID: 1, UserID: userId}
	res, err := ac.GetUserPermissions(context.Background(), userPermissionsQuery)
	require.NoError(b, err)
	expectedPermissions := actesting.PermissionsPerRole * rolesPerUser
	assert.Greater(b, len(res), expectedPermissions)
}

func benchmarkRoles(b *testing.B, rolesPerUser, users int) {
	ac := setup(b, rolesPerUser, users)
	// We don't wanna measure DB initialization
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		getRoles(b, ac, rolesPerUser, users)
	}
}

func BenchmarkRolesUsers10_10(b *testing.B) { benchmarkRoles(b, 10, 10) }

func BenchmarkRolesUsers10_100(b *testing.B)  { benchmarkRoles(b, 10, 100) }
func BenchmarkRolesUsers10_500(b *testing.B)  { benchmarkRoles(b, 10, 500) }
func BenchmarkRolesUsers10_1000(b *testing.B) { benchmarkRoles(b, 10, 1000) }
func BenchmarkRolesUsers10_5000(b *testing.B) { benchmarkRoles(b, 10, 5000) }
func BenchmarkRolesUsers10_10000(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchmarkRoles(b, 10, 10000)
}

func BenchmarkRolesPerUser10_10(b *testing.B)   { benchmarkRoles(b, 10, 10) }
func BenchmarkRolesPerUser100_10(b *testing.B)  { benchmarkRoles(b, 100, 10) }
func BenchmarkRolesPerUser500_10(b *testing.B)  { benchmarkRoles(b, 500, 10) }
func BenchmarkRolesPerUser1000_10(b *testing.B) { benchmarkRoles(b, 1000, 10) }
