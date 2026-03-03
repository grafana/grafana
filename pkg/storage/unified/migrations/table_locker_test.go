package migrations

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type tableLockerMock struct {
	unlockFunc func(context.Context) error
	tables     []string
}

func (m *tableLockerMock) LockMigrationTables(_ context.Context, _ *xorm.Session, tables []string) (func(context.Context) error, error) {
	m.tables = tables
	return m.unlockFunc, nil
}

func TestIntegrationMigrationRunnerLocksTables(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if db.IsTestDbSQLite() {
		t.Skip("SQLite uses no-op locker")
	}

	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)

	gr := schema.GroupResource{Group: "group", Resource: "resource"}
	unlockCalled := false
	locker := &tableLockerMock{unlockFunc: func(context.Context) error { unlockCalled = true; return nil }}
	def := MigrationDefinition{
		ID: "test", MigrationID: "test",
		Resources: []ResourceInfo{{GroupResource: gr, LockTables: []string{"resource"}}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
	}
	m := NewMockUnifiedMigrator(t)
	m.EXPECT().Migrate(mock.Anything, mock.Anything).Return(&resourcepb.BulkResponse{}, nil)
	m.EXPECT().RebuildIndexes(mock.Anything, mock.Anything).Return(nil)

	runner := NewMigrationRunner(m, locker, def, nil)
	engine := dbstore.GetEngine()
	mg := migrator.NewMigrator(engine, setting.NewCfg())
	sess := engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())
	_, _ = sess.Exec("INSERT INTO org (id, name, created, updated, version) VALUES (1, 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)")

	require.NoError(t, runner.Run(context.Background(), sess, mg, RunOptions{DriverName: engine.DriverName()}))
	require.True(t, unlockCalled)
	require.Equal(t, []string{"resource"}, locker.tables)
}

func createTestTable(t *testing.T, dbstore db.DB) string {
	t.Helper()
	name := fmt.Sprintf("test_lock_%s", uuid.New().String()[:8])
	engine := dbstore.GetEngine()
	_, err := engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY, val TEXT)", engine.Quote(name)))
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name))) })
	return name
}

func TestIntegrationTableLocker(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	engine := dbstore.GetEngine()
	ctx := context.Background()
	type lockerTestSetup struct {
		name   string
		locker MigrationTableLocker
		sess   func(t *testing.T) *xorm.Session
	}
	var setup lockerTestSetup
	switch dbstore.GetDBType() {
	case migrator.Postgres:
		sqlProvider := legacysql.NewDatabaseProvider(dbstore)
		setup = lockerTestSetup{
			name:   "postgres",
			locker: &postgresTableLocker{sql: sqlProvider},
			sess: func(t *testing.T) *xorm.Session {
				t.Helper()
				s := engine.NewSession()
				t.Cleanup(func() { _ = s.Rollback(); s.Close() })
				require.NoError(t, s.Begin())
				return s
			},
		}
	case migrator.MySQL:
		sqlProvider := legacysql.NewDatabaseProvider(dbstore)
		setup = lockerTestSetup{
			name:   "mysql",
			locker: &mysqlTableLocker{sql: sqlProvider},
			sess:   func(t *testing.T) *xorm.Session { return nil }, // MySQL locker doesn't use session
		}
	default:
		setup = lockerTestSetup{
			name:   "sqlite",
			locker: &sqliteTableLocker{},
			sess:   func(t *testing.T) *xorm.Session { return nil },
		}
	}

	t.Run(setup.name+"/lock and unlock tables", func(t *testing.T) {
		tables := []string{createTestTable(t, dbstore), createTestTable(t, dbstore)}
		sess := setup.sess(t) // register sess cleanup AFTER table cleanup (LIFO: sess closes first)
		unlock, err := setup.locker.LockMigrationTables(ctx, sess, tables)
		require.NoError(t, err)
		require.NoError(t, unlock(ctx))
	})

	t.Run(setup.name+"/empty tables list returns no-op", func(t *testing.T) {
		sess := setup.sess(t)
		unlock, err := setup.locker.LockMigrationTables(ctx, sess, nil)
		require.NoError(t, err)
		require.NoError(t, unlock(ctx))
	})

	t.Run(setup.name+"/verify lock prevents writes", func(t *testing.T) {
		if db.IsTestDbSQLite() {
			t.Skip("Skipping for SQLite, locking is not needed due to single writer connection")
		}
		table := createTestTable(t, dbstore)
		sess := setup.sess(t) // register sess cleanup AFTER table cleanup
		unlock, err := setup.locker.LockMigrationTables(ctx, sess, []string{table})
		require.NoError(t, err)
		require.NotNil(t, unlock)

		// Try to write to the locked table from a separate connection (goroutine).
		writeErr := make(chan error, 1)
		go func() {
			_, werr := engine.Exec(fmt.Sprintf("UPDATE %s SET val=val WHERE id=-1", engine.Quote(table)))
			writeErr <- werr
		}()

		// Verify that write is blocked while the lock is held
		select {
		case <-writeErr:
			t.Fatal("Write should be blocked while lock is held")
		case <-time.After(2 * time.Second):
			// Good — write is still blocked after 2s
		}

		// Release the lock
		require.NoError(t, unlock(ctx))
		if sess != nil {
			_ = sess.Rollback()
		}

		// Now write should complete
		select {
		case err = <-writeErr:
			require.NoError(t, err, "Write should succeed after unlock")
		case <-time.After(10 * time.Second):
			t.Fatal("Write is still blocked after unlock")
		}
	})
}
