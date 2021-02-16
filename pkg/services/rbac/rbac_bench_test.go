package rbac

import (
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setup(b *testing.B, policiesPerUser, users int) *RBACService {
	ac := setupTestEnv(b)
	b.Cleanup(registry.ClearOverrides)
	generatePolicies(b, ac, policiesPerUser, users)
	return ac
}

func getPolicies(b *testing.B, ac *RBACService, policiesPerUser, users int) {
	userQuery := models.GetUserByLoginQuery{
		LoginOrEmail: "user1@test.com",
	}
	err := sqlstore.GetUserByLogin(&userQuery)
	require.NoError(b, err)
	userId := userQuery.Result.Id

	userPermissionsQuery := GetUserPermissionsQuery{OrgId: 1, UserId: userId}
	res, err := ac.GetUserPermissions(&userPermissionsQuery)
	require.NoError(b, err)
	expectedPermissions := permissionsPerPolicy * policiesPerUser
	assert.Greater(b, len(res), expectedPermissions)
}

func benchmarkPolicies(b *testing.B, policiesPerUser, users int) {
	ac := setup(b, policiesPerUser, users)
	// We don't wanna measure DB initialization
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		getPolicies(b, ac, policiesPerUser, users)
	}
}

func BenchmarkPolicies10_10(b *testing.B) { benchmarkPolicies(b, 10, 10) }

func BenchmarkPolicies10_100(b *testing.B)  { benchmarkPolicies(b, 10, 100) }
func BenchmarkPolicies10_1000(b *testing.B) { benchmarkPolicies(b, 10, 1000) }

// func BenchmarkPolicies10_10000(b *testing.B) { benchmarkPolicies(b, 10, 10000) }

func BenchmarkPolicies100_10(b *testing.B)   { benchmarkPolicies(b, 100, 10) }
func BenchmarkPolicies1000_10(b *testing.B)  { benchmarkPolicies(b, 1000, 10) }
func BenchmarkPolicies10000_10(b *testing.B) { benchmarkPolicies(b, 10000, 10) }
