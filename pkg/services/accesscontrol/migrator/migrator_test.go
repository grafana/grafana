package migrator

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

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

// TestIntegrationMigrateScopeSplit tests the scope split migration
// also tests the scope split truncation logic
func TestIntegrationMigrateScopeSplitTruncation(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	sqlStore := db.InitTestDB(t)
	logger := log.New("accesscontrol.migrator.test")

	batchSize = 20
	// Populate permissions
	require.NoError(t, batchInsertPermissions(3*batchSize, sqlStore), "could not insert permissions")

	// Insert a permission with a scope longer than 240 characters
	longScope := strings.Repeat("a", 60) + ":" + strings.Repeat("b", 60) + ":" + strings.Repeat("c", 60)
	permission := ac.Permission{
		RoleID:  1,
		Action:  "action",
		Scope:   longScope,
		Created: time.Now(),
		Updated: time.Now(),
	}
	require.NoError(t, sqlStore.WithDbSession(context.Background(), func(sess *db.Session) error {
		_, err := sess.Insert(permission)
		return err
	}), "could not insert permission with long scope")

	// Migrate
	require.NoError(t, MigrateScopeSplit(sqlStore, logger))

	// Check migration result
	permissions := make([]ac.Permission, 0, 3*batchSize+1)
	errFind := sqlStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		return sess.Find(&permissions)
	})
	require.NoError(t, errFind, "could not find permissions in store")

	for i := range permissions {
		if permissions[i].Scope == longScope {
			assert.Equal(t, strings.Repeat("a", 40), permissions[i].Kind)
			assert.Equal(t, strings.Repeat("b", 40), permissions[i].Attribute)
			assert.Equal(t, strings.Repeat("c", 40), permissions[i].Identifier)
		}
	}
}
