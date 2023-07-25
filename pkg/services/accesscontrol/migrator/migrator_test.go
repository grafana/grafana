package migrator

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
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
