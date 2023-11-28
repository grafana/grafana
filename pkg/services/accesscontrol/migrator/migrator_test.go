package migrator

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/require"
)

func batchInsertPermissions(cnt int, sqlStore db.DB) error {
	now := time.Now()

	return batch(cnt, batchSize, func(start, end int) error {
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
		return sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Insert(permissions)
			return err
		})
	})
}

func TestMigrateScopeSplit(t *testing.T) {
	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	// Populate permissions
	require.NoError(t, batchInsertPermissions(3*batchSize, sqlStore), "could not insert permissions")

	// Migrate
	require.NoError(t, MigrateScopeSplit(sqlStore, logger))

	// Check migration result
	permissions := make([]ac.Permission, 0, 3*batchSize)
	errFind := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Find(&permissions)
	})
	require.NoError(t, errFind, "could not find permissions in store")

	for i := range permissions {
		require.Equal(t, fmt.Sprintf("resource:uid:%v", i+1), permissions[i].Scope, "scope should have been preserved")
		require.Equal(t, "resource", permissions[i].Kind)
		require.Equal(t, "uid", permissions[i].Attribute)
		require.Equal(t, fmt.Sprintf("%v", i+1), permissions[i].Identifier)
	}
}
