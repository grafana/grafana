package rbac

import (
	"context"
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
	res, err := ac.GetUserPermissions(context.Background(), userPermissionsQuery)
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

func BenchmarkPoliciesUsers10_10(b *testing.B) { benchmarkPolicies(b, 10, 10) }

func BenchmarkPoliciesUsers10_100(b *testing.B)  { benchmarkPolicies(b, 10, 100) }
func BenchmarkPoliciesUsers10_500(b *testing.B)  { benchmarkPolicies(b, 10, 500) }
func BenchmarkPoliciesUsers10_1000(b *testing.B) { benchmarkPolicies(b, 10, 1000) }
func BenchmarkPoliciesUsers10_5000(b *testing.B) { benchmarkPolicies(b, 10, 5000) }
func BenchmarkPoliciesUsers10_10000(b *testing.B) {
	if testing.Short() {
		b.Skip("Skipping benchmark in short mode")
	}
	benchmarkPolicies(b, 10, 10000)
}

func BenchmarkPoliciesPerUser10_10(b *testing.B)   { benchmarkPolicies(b, 10, 10) }
func BenchmarkPoliciesPerUser100_10(b *testing.B)  { benchmarkPolicies(b, 100, 10) }
func BenchmarkPoliciesPerUser500_10(b *testing.B)  { benchmarkPolicies(b, 500, 10) }
func BenchmarkPoliciesPerUser1000_10(b *testing.B) { benchmarkPolicies(b, 1000, 10) }
