package accesscontrol

import (
	"context"
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func BenchmarkFilter10_10(b *testing.B)   { benchmarkFilter(b, 10, 10) }
func BenchmarkFilter100_10(b *testing.B)  { benchmarkFilter(b, 100, 10) }
func BenchmarkFilter100_100(b *testing.B) { benchmarkFilter(b, 100, 100) }

func benchmarkFilter(b *testing.B, numDs, numPermissions int) {
	store, permissions := setupFilterBenchmark(b, numDs, numPermissions)
	b.ResetTimer()

	// set sqlIDAcceptList before running tests
	sqlIDAcceptList = map[string]struct{}{
		"data_source.id": {},
	}

	for i := 0; i < b.N; i++ {
		baseSql := `SELECT data_source.* FROM data_source WHERE`
		query, args, err := Filter(
			context.Background(),
			&FakeDriver{name: "sqlite3"},
			"data_source.id",
			"datasources",
			"datasources:read",
			&models.SignedInUser{OrgId: 1, Permissions: map[int64]map[string][]string{1: GroupScopesByAction(permissions)}},
		)
		require.NoError(b, err)

		var datasources []models.DataSource
		sess := store.NewSession(context.Background())
		err = sess.SQL(baseSql+query, args...).Find(&datasources)
		require.NoError(b, err)
		sess.Close()
		require.Len(b, datasources, numPermissions)
	}
}

func setupFilterBenchmark(b *testing.B, numDs, numPermissions int) (*sqlstore.SQLStore, []*Permission) {
	b.Helper()
	store := sqlstore.InitTestDB(b)

	for i := 1; i <= numDs; i++ {
		err := store.AddDataSource(context.Background(), &models.AddDataSourceCommand{
			Name:  fmt.Sprintf("ds:%d", i),
			OrgId: 1,
		})
		require.NoError(b, err)
	}

	if numPermissions > numDs {
		numPermissions = numDs
	}

	permissions := make([]*Permission, 0, numPermissions)
	for i := 1; i <= numPermissions; i++ {
		permissions = append(permissions, &Permission{
			Action: "datasources:read",
			Scope:  Scope("datasources", "id", strconv.Itoa(i)),
		})
	}

	return store, permissions
}
