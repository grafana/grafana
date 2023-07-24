package migrator

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

// setupPermissions will create cnt permissions
func setupPermissions(b *testing.B, cnt int) db.DB {
	now := time.Now()
	sqlStore := db.InitTestDB(b)

	// Populate permissions
	if errInsert := ac.ConcurrentBatch(ac.Concurrency, cnt, ac.BatchSize, func(start, end int) error {
		n := end - start
		permissions := make([]ac.Permission, 0, n)
		for i := start + 1; i < end+1; i++ {
			permissions = append(permissions, ac.Permission{
				RoleID:  1,
				Action:  "action",
				Scope:   fmt.Sprintf("resource:uid:%v", i),
				Created: now,
				Updated: now,
			})
		}
		err := sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(permissions)
			return err
		})
		return err
	}); errInsert != nil {
		require.NoError(b, errInsert, "could not insert permissions")
	}

	return sqlStore
}

func benchScopeSplit(b *testing.B, count int) {
	store := setupPermissions(b, count)
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplit(store, logger)
		require.NoError(b, err)
	}
}

func benchScopeSplitV2(b *testing.B, count int) {
	store := setupPermissions(b, count)
	logger := log.New("migrator.test")
	b.ResetTimer()

	for n := 0; n < b.N; n++ {
		err := MigrateScopeSplitV2(store, logger)
		require.NoError(b, err)
	}
}

func BenchmarkMigrateScopeSplit_1K(b *testing.B) { benchScopeSplit(b, 1000) }

func BenchmarkMigrateScopeSplit_50K(b *testing.B)   { benchScopeSplit(b, 50000) }   // pg: 9.1 s/op mysql: 11.7 s/op
func BenchmarkMigrateScopeSplitV2_50K(b *testing.B) { benchScopeSplitV2(b, 50000) } // pg:0.045 s/op mysql: deadlock

func BenchmarkMigrateScopeSplit_100K(b *testing.B)   { benchScopeSplit(b, 100000) }   // pg: ~18.4s/op, mysql8: ~25,1s/op
func BenchmarkMigrateScopeSplitV2_100K(b *testing.B) { benchScopeSplitV2(b, 100000) } // pg: ~1.8s/op, mysql8: ~7.04s/op
