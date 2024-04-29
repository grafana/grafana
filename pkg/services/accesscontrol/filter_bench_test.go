package accesscontrol_test

import (
	"context"
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsService "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/user"
)

func BenchmarkFilter10_10(b *testing.B)     { benchmarkFilter(b, 10, 10) }
func BenchmarkFilter100_10(b *testing.B)    { benchmarkFilter(b, 100, 10) }
func BenchmarkFilter100_100(b *testing.B)   { benchmarkFilter(b, 100, 100) }
func BenchmarkFilter1000_100(b *testing.B)  { benchmarkFilter(b, 1000, 100) }
func BenchmarkFilter1000_1000(b *testing.B) { benchmarkFilter(b, 1000, 100) }

func benchmarkFilter(b *testing.B, numDs, numPermissions int) {
	store, permissions := setupFilterBenchmark(b, numDs, numPermissions)
	b.ResetTimer()

	// set sqlIDAcceptList before running tests
	restore := accesscontrol.SetAcceptListForTest(map[string]struct{}{
		"data_source.id": {},
	})
	defer restore()

	for i := 0; i < b.N; i++ {
		baseSql := `SELECT data_source.* FROM data_source WHERE`
		acFilter, err := accesscontrol.Filter(
			&user.SignedInUser{OrgID: 1, Permissions: map[int64]map[string][]string{1: accesscontrol.GroupScopesByAction(permissions)}},
			"data_source.id",
			"datasources:id:",
			"datasources:read",
		)
		require.NoError(b, err)

		var datasources []datasources.DataSource
		err = store.WithDbSession(context.Background(), func(sess *db.Session) error {
			return sess.SQL(baseSql+acFilter.Where, acFilter.Args...).Find(&datasources)
		})
		require.NoError(b, err)
		require.Len(b, datasources, numPermissions)
	}
}

func setupFilterBenchmark(b *testing.B, numDs, numPermissions int) (db.DB, []accesscontrol.Permission) {
	b.Helper()
	sqlStore := db.InitTestDB(b)
	store := dsService.CreateStore(sqlStore, log.New("accesscontrol.test"))
	for i := 1; i <= numDs; i++ {
		_, err := store.AddDataSource(context.Background(), &datasources.AddDataSourceCommand{
			Name:  fmt.Sprintf("ds:%d", i),
			OrgID: 1,
		})
		require.NoError(b, err)
	}

	if numPermissions > numDs {
		numPermissions = numDs
	}

	permissions := make([]accesscontrol.Permission, 0, numPermissions)
	for i := 1; i <= numPermissions; i++ {
		permissions = append(permissions, accesscontrol.Permission{
			Action: "datasources:read",
			Scope:  accesscontrol.Scope("datasources", "id", strconv.Itoa(i)),
		})
	}

	return sqlStore, permissions
}
