package migrations

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/storage/testutil"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type tableLockerMock struct {
	unlockFunc func(context.Context) error
	tables     []string
}

func (m *tableLockerMock) LockMigrationTables(_ context.Context, _ storagemigrator.Queryer, _ *storagemigrator.Migrator, tables []string) (func(context.Context) error, error) {
	m.tables = tables
	return m.unlockFunc, nil
}

func TestIntegrationMigrationRunnerLocksTables(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if isTestDBSQLite() {
		t.Skip("SQLite uses no-op locker")
	}

	env := newTestEnv(t)

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

	runner := NewMigrationRunner(m, locker, &transactionalTableRenamer{log: logger}, setting.NewCfg(), def, nil)
	mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
	tx, err := env.store.GetSqlxSession().SqlDB().BeginTx(context.Background(), nil)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()

	require.NoError(t, runner.Run(context.Background(), tx, mg, RunOptions{DriverName: env.store.GetSqlxSession().DriverName()}))
	require.NoError(t, tx.Commit())
	require.True(t, unlockCalled)
	require.Equal(t, []string{"resource"}, locker.tables)
}

func createTestTable(t *testing.T, store *testStore) string {
	t.Helper()
	name := fmt.Sprintf("test_lock_%s", uuid.New().String()[:8])
	dialect := storagemigrator.NewDialect(store.GetSqlxSession().DriverName())
	_, err := store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY, val TEXT)", dialect.Quote(name)))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", dialect.Quote(name)))
	})
	return name
}

func TestIntegrationTableLocker(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	env := newTestEnv(t)
	ctx := context.Background()
	mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())

	type lockerTestSetup struct {
		name    string
		locker  MigrationTableLocker
		queryer func(t *testing.T) (storagemigrator.Queryer, func())
	}

	var setup lockerTestSetup
	switch env.store.GetSqlxSession().DriverName() {
	case storagemigrator.Postgres:
		sqlProvider := legacysql.NewDatabaseProvider(env.store)
		setup = lockerTestSetup{
			name:   "postgres",
			locker: &postgresTableLocker{sql: sqlProvider},
			queryer: func(t *testing.T) (storagemigrator.Queryer, func()) {
				t.Helper()
				tx, err := env.store.GetSqlxSession().SqlDB().BeginTx(ctx, nil)
				require.NoError(t, err)
				return tx, func() { _ = tx.Rollback() }
			},
		}
	case storagemigrator.MySQL:
		sqlProvider := legacysql.NewDatabaseProvider(env.store)
		setup = lockerTestSetup{
			name:   "mysql",
			locker: &mysqlTableLocker{sql: sqlProvider},
			queryer: func(t *testing.T) (storagemigrator.Queryer, func()) {
				t.Helper()
				return env.store.GetSqlxSession().SqlDB(), func() {}
			},
		}
	default:
		setup = lockerTestSetup{
			name:   "sqlite",
			locker: &sqliteTableLocker{},
			queryer: func(t *testing.T) (storagemigrator.Queryer, func()) {
				t.Helper()
				return env.store.GetSqlxSession().SqlDB(), func() {}
			},
		}
	}

	t.Run(setup.name+"/lock and unlock tables", func(t *testing.T) {
		tables := []string{createTestTable(t, env.store), createTestTable(t, env.store)}
		queryer, cleanup := setup.queryer(t)
		defer cleanup()
		unlock, err := setup.locker.LockMigrationTables(ctx, queryer, mg, tables)
		require.NoError(t, err)
		require.NoError(t, unlock(ctx))
	})

	t.Run(setup.name+"/empty tables list returns no-op", func(t *testing.T) {
		queryer, cleanup := setup.queryer(t)
		defer cleanup()
		unlock, err := setup.locker.LockMigrationTables(ctx, queryer, mg, nil)
		require.NoError(t, err)
		require.NoError(t, unlock(ctx))
	})

	t.Run(setup.name+"/verify lock prevents writes", func(t *testing.T) {
		if isTestDBSQLite() {
			t.Skip("Skipping for SQLite, locking is not needed due to single writer connection")
		}
		table := createTestTable(t, env.store)
		queryer, cleanup := setup.queryer(t)
		defer cleanup()
		unlock, err := setup.locker.LockMigrationTables(ctx, queryer, mg, []string{table})
		require.NoError(t, err)
		require.NotNil(t, unlock)

		// Try to write to the locked table from a separate connection (goroutine).
		dialect := storagemigrator.NewDialect(env.store.GetSqlxSession().DriverName())
		writeErr := make(chan error, 1)
		go func() {
			conn, err := env.store.GetSqlxSession().SqlDB().Conn(ctx)
			if err != nil {
				writeErr <- err
				return
			}
			defer func() { _ = conn.Close() }()
			_, werr := conn.ExecContext(ctx, fmt.Sprintf("UPDATE %s SET val=val WHERE id=-1", dialect.Quote(table)))
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

		// Now write should complete
		select {
		case err = <-writeErr:
			require.NoError(t, err, "Write should succeed after unlock")
		case <-time.After(10 * time.Second):
			t.Fatal("Write is still blocked after unlock")
		}
	})
}
