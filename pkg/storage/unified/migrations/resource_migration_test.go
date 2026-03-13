package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	testsqlutil "github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	storageq "github.com/grafana/grafana/pkg/storage/sqlutil"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	sqlBackend "github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/tests/storage/testutil"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type testEnv struct {
	store *testStore
}

type testStore struct {
	session *session.SessionDB
}

func (s *testStore) GetSqlxSession() *session.SessionDB {
	return s.session
}

func newTestEnv(t *testing.T) testEnv {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	dbstore := newTestStore(t)
	ensureOrg(t, dbstore)
	return testEnv{store: dbstore}
}

func newTestStore(t *testing.T) *testStore {
	t.Helper()
	dbType := testsqlutil.GetTestDBType()
	var (
		dbCfg       *testsqlutil.TestDB
		err         error
		driverName  string
		connStr     string
		cleanupFunc func()
	)

	if dbType == storagemigrator.SQLite {
		driverName = storagemigrator.SQLite
		path := filepath.Join(t.TempDir(), "grafana-storage-tests.db")
		connStr = "file:" + path + "?cache=private&mode=rwc&_journal_mode=WAL&_synchronous=OFF"
		cleanupFunc = func() {}
	} else {
		dbCfg, err = testsqlutil.GetTestDB(dbType)
		require.NoError(t, err)
		driverName = dbCfg.DriverName
		connStr = dbCfg.ConnStr
		cleanupFunc = dbCfg.Cleanup
	}

	db, err := sql.Open(driverName, connStr)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, db.Close())
		cleanupFunc()
	})

	return &testStore{
		session: session.GetSession(sqlx.NewDb(db, driverName)),
	}
}

func uniqueTable(t *testing.T, store *testStore) string {
	t.Helper()
	dialect := storagemigrator.NewDialect(store.GetSqlxSession().DriverName())
	name := fmt.Sprintf("test_%s", uuid.New().String()[:8])
	_, err := store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY, val TEXT)", dialect.Quote(name)))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", dialect.Quote(name)))
		_, _ = store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", dialect.Quote(name+legacySuffix)))
	})
	return name
}

func dummyGR() schema.GroupResource {
	return schema.GroupResource{Group: "test.group", Resource: "test-resource"}
}

func testDef(gr schema.GroupResource, lockTables, renameTables []string) MigrationDefinition {
	return MigrationDefinition{
		ID: "test-def", MigrationID: "test-migration",
		Resources: []ResourceInfo{{GroupResource: gr, LockTables: lockTables}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
		RenameTables: renameTables,
	}
}

func newRunner(t *testing.T, locker MigrationTableLocker, renamer MigrationTableRenamer, def MigrationDefinition) (*MigrationRunner, *MockUnifiedMigrator) {
	t.Helper()
	m := NewMockUnifiedMigrator(t)
	m.EXPECT().Migrate(mock.Anything, mock.Anything).Return(&resourcepb.BulkResponse{}, nil)
	m.EXPECT().RebuildIndexes(mock.Anything, mock.Anything).Return(nil)
	return NewMigrationRunner(m, locker, renamer, setting.NewCfg(), def, nil), m
}

func ensureOrg(t *testing.T, store *testStore) {
	t.Helper()
	_, err := store.GetSqlxSession().Exec(context.Background(), `
		CREATE TABLE IF NOT EXISTS org (
			id BIGINT PRIMARY KEY,
			name VARCHAR(255),
			created TIMESTAMP NULL,
			updated TIMESTAMP NULL,
			version BIGINT NOT NULL
		)
	`)
	require.NoError(t, err)

	var count int64
	err = store.GetSqlxSession().Get(context.Background(), &count, "SELECT COUNT(*) FROM org WHERE id = ?", 1)
	require.NoError(t, err)
	if count == 0 {
		_, err := store.GetSqlxSession().Exec(context.Background(), "INSERT INTO org (id, name, created, updated, version) VALUES (1, 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)")
		require.NoError(t, err)
	}
}

func runMigration(t *testing.T, store *testStore, runner *MigrationRunner, driverName string) {
	t.Helper()
	mg := storagemigrator.NewMigrator(store.GetSqlxSession())
	tx, err := store.GetSqlxSession().SqlDB().BeginTx(context.Background(), nil)
	require.NoError(t, err)
	require.NoError(t, runner.Run(context.Background(), tx, mg, RunOptions{DriverName: driverName}))
	require.NoError(t, tx.Commit())
}

func assertRenamed(t *testing.T, store *testStore, tables ...string) {
	t.Helper()
	dialect := storagemigrator.NewDialect(store.GetSqlxSession().DriverName())
	for _, table := range tables {
		exists, err := storageq.TableExists(context.Background(), store.GetSqlxSession().SqlDB(), dialect, table)
		require.NoError(t, err)
		require.False(t, exists, "%s should be gone", table)
		exists, err = storageq.TableExists(context.Background(), store.GetSqlxSession().SqlDB(), dialect, table+legacySuffix)
		require.NoError(t, err)
		require.True(t, exists, "%s_legacy should exist", table)
	}
}

func assertNotRenamed(t *testing.T, store *testStore, table string) {
	t.Helper()
	dialect := storagemigrator.NewDialect(store.GetSqlxSession().DriverName())
	exists, err := storageq.TableExists(context.Background(), store.GetSqlxSession().SqlDB(), dialect, table)
	require.NoError(t, err)
	require.True(t, exists)
	exists, err = storageq.TableExists(context.Background(), store.GetSqlxSession().SqlDB(), dialect, table+legacySuffix)
	require.NoError(t, err)
	require.False(t, exists)
}

func isTestDBSQLite() bool {
	return !isTestDBMySQL() && !isTestDBPostgres()
}

func isTestDBMySQL() bool {
	return testsqlutil.GetTestDBType() == storagemigrator.MySQL
}

func isTestDBPostgres() bool {
	return testsqlutil.GetTestDBType() == storagemigrator.Postgres
}

func noopLocker() *tableLockerMock {
	return &tableLockerMock{unlockFunc: func(context.Context) error { return nil }}
}

func TestIntegrationRun_Postgres_LocksOnSession(t *testing.T) {
	env := newTestEnv(t)
	if !isTestDBPostgres() {
		t.Skip("Postgres-only")
	}

	table := uniqueTable(t, env.store)
	sqlProvider := legacysql.NewDatabaseProvider(env.store)
	runner, _ := newRunner(t, &postgresTableLocker{sql: sqlProvider}, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
	runMigration(t, env.store, runner, storagemigrator.Postgres)
}

func TestIntegrationRun_MySQL_UsesTableLocker(t *testing.T) {
	env := newTestEnv(t)
	if !isTestDBMySQL() {
		t.Skip("MySQL-only")
	}

	table := uniqueTable(t, env.store)
	unlockCalled := false
	locker := &tableLockerMock{unlockFunc: func(context.Context) error { unlockCalled = true; return nil }}
	runner, _ := newRunner(t, locker, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
	runMigration(t, env.store, runner, storagemigrator.MySQL)

	require.True(t, unlockCalled)
	require.Equal(t, []string{table}, locker.tables)
}

func TestIntegrationRun_Rename(t *testing.T) {
	env := newTestEnv(t)

	type renameCase struct {
		name        string
		skip        func() bool
		locker      func() MigrationTableLocker
		renamer     func() MigrationTableRenamer
		numTables   int
		wantRenamed bool
	}

	cases := []renameCase{
		{
			name: "Postgres",
			skip: func() bool { return !isTestDBPostgres() },
			locker: func() MigrationTableLocker {
				return &postgresTableLocker{sql: legacysql.NewDatabaseProvider(env.store)}
			},
			renamer:   func() MigrationTableRenamer { return &transactionalTableRenamer{log: logger} },
			numTables: 1, wantRenamed: true,
		},
		{
			name:      "SQLite",
			skip:      func() bool { return !isTestDBSQLite() },
			locker:    func() MigrationTableLocker { return noopLocker() },
			renamer:   func() MigrationTableRenamer { return &transactionalTableRenamer{log: logger} },
			numTables: 1, wantRenamed: true,
		},
		{
			name:      "SQLite no rename configured",
			skip:      func() bool { return !isTestDBSQLite() },
			locker:    func() MigrationTableLocker { return noopLocker() },
			renamer:   func() MigrationTableRenamer { return &transactionalTableRenamer{log: logger} },
			numTables: 1, wantRenamed: false,
		},
		{
			name: "MySQL multiple tables",
			skip: func() bool { return !isTestDBMySQL() },
			locker: func() MigrationTableLocker {
				return &mysqlTableLocker{sql: legacysql.NewDatabaseProvider(env.store)}
			},
			renamer:   func() MigrationTableRenamer { return &mysqlTableRenamer{log: logger, waitDeadline: time.Minute} },
			numTables: 2, wantRenamed: true,
		},
		{
			name: "MySQL no rename configured",
			skip: func() bool { return !isTestDBMySQL() },
			locker: func() MigrationTableLocker {
				return &mysqlTableLocker{sql: legacysql.NewDatabaseProvider(env.store)}
			},
			renamer:   func() MigrationTableRenamer { return &mysqlTableRenamer{log: logger, waitDeadline: time.Minute} },
			numTables: 1, wantRenamed: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.skip() {
				t.Skip("skipped for this DB type")
			}

			tables := make([]string, tc.numTables)
			for i := range tables {
				tables[i] = uniqueTable(t, env.store)
			}

			var renameTables []string
			if tc.wantRenamed {
				renameTables = tables
			}

			runner, _ := newRunner(t, tc.locker(), tc.renamer(), testDef(dummyGR(), tables, renameTables))
			runMigration(t, env.store, runner, env.store.GetSqlxSession().DriverName())

			if tc.wantRenamed {
				assertRenamed(t, env.store, tables...)
			} else {
				assertNotRenamed(t, env.store, tables[0])
			}
		})
	}
}

func TestIntegrationMySQL_WaitForRenamesQueued(t *testing.T) {
	env := newTestEnv(t)
	if !isTestDBMySQL() {
		t.Skip("MySQL-only")
	}

	t.Run("single table detected", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
		mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
		renamer.Init(env.store.GetSqlxSession().SqlDB(), mg)

		unlock, results := lockAndQueueRename(t, env.store, []string{table})

		require.NoError(t, renamer.waitForRenamesQueued(context.Background(), []renamePair{{table, table + legacySuffix}}))

		unlock()
		select {
		case err := <-results[0]:
			require.NoError(t, err)
		case <-time.After(10 * time.Second):
			t.Fatal("RENAME timed out")
		}
	})

	t.Run("multiple tables detected", func(t *testing.T) {
		t1, t2 := uniqueTable(t, env.store), uniqueTable(t, env.store)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
		mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
		renamer.Init(env.store.GetSqlxSession().SqlDB(), mg)

		unlock, results := lockAndQueueRename(t, env.store, []string{t1, t2})
		require.Len(t, results, 2, "expected one result channel per table")

		pairs := []renamePair{{t1, t1 + legacySuffix}, {t2, t2 + legacySuffix}}
		require.NoError(t, renamer.waitForRenamesQueued(context.Background(), pairs))

		unlock()
		completed := 0
		for _, ch := range results {
			select {
			case err := <-ch:
				require.NoError(t, err)
				completed++
			case <-time.After(10 * time.Second):
				t.Fatal("RENAME timed out")
			}
		}
		require.Equal(t, 2, completed, "both renames should complete")
	})

	t.Run("mismatched table times out", func(t *testing.T) {
		t1, t2 := uniqueTable(t, env.store), uniqueTable(t, env.store)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: 500 * time.Millisecond}
		mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
		renamer.Init(env.store.GetSqlxSession().SqlDB(), mg)

		unlock, results := lockAndQueueRename(t, env.store, []string{t1, t2})

		// Wait for the real renames to be queued first so the RENAME goroutines
		// are actually blocked before we test the mismatch.
		pairs := []renamePair{{t1, t1 + legacySuffix}, {t2, t2 + legacySuffix}}
		require.NoError(t, renamer.waitForRenamesQueued(context.Background(), pairs))

		err := renamer.waitForRenamesQueued(context.Background(), []renamePair{{t1, t1 + legacySuffix}, {"nonexistent_xyz", "nonexistent_xyz" + legacySuffix}})
		require.Error(t, err)
		require.Contains(t, err.Error(), "timeout")

		unlock()
		for _, ch := range results {
			select {
			case err := <-ch:
				require.NoError(t, err)
			case <-time.After(10 * time.Second):
				t.Fatal("RENAME timed out")
			}
		}
	})

	t.Run("context cancellation", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
		mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
		renamer.Init(env.store.GetSqlxSession().SqlDB(), mg)

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		err := renamer.waitForRenamesQueued(ctx, []renamePair{{table, table + legacySuffix}})
		require.Error(t, err)
		require.Contains(t, err.Error(), "context cancelled")
	})
}

// lockAndQueueRename acquires a READ lock on the given tables and launches a
// goroutine per table that issues a RENAME (which blocks until the lock is
// released). It returns an unlock function and a channel per table that
// delivers the rename result.
func lockAndQueueRename(t *testing.T, store *testStore, tables []string) (unlock func(), results []<-chan error) {
	t.Helper()
	if !isTestDBMySQL() {
		t.Skip("MySQL-only")
	}

	dialect := storagemigrator.NewDialect(store.GetSqlxSession().DriverName())
	lockConn, err := store.GetSqlxSession().SqlDB().Conn(context.Background())
	require.NoError(t, err)

	// Build "t1 READ, t2 READ, ..." lock statement.
	lockStmt := ""
	for i, tbl := range tables {
		if i > 0 {
			lockStmt += ", "
		}
		lockStmt += dialect.Quote(tbl) + " READ"
	}
	_, err = lockConn.ExecContext(context.Background(), "LOCK TABLES "+lockStmt)
	require.NoError(t, err)

	unlocked := false
	unlock = func() {
		if !unlocked {
			unlocked = true
			_, _ = lockConn.ExecContext(context.Background(), "UNLOCK TABLES")
		}
	}
	t.Cleanup(func() {
		unlock()
		_ = lockConn.Close()
	})

	results = make([]<-chan error, len(tables))
	for i, tbl := range tables {
		ch := make(chan error, 1)
		results[i] = ch
		go func(tbl string, ch chan<- error) {
			conn, cerr := store.GetSqlxSession().SqlDB().Conn(context.Background())
			if cerr != nil {
				ch <- cerr
				return
			}
			defer func() { _ = conn.Close() }()
			_, rerr := conn.ExecContext(context.Background(),
				fmt.Sprintf("RENAME TABLE %s TO %s", dialect.Quote(tbl), dialect.Quote(tbl+legacySuffix)))
			ch <- rerr
		}(tbl, ch)
	}
	return unlock, results
}

func TestIntegrationRunMySQL_CrashRecovery(t *testing.T) {
	env := newTestEnv(t)
	if !isTestDBMySQL() {
		t.Skip("MySQL-only")
	}

	t1, t2 := uniqueTable(t, env.store), uniqueTable(t, env.store)
	def := testDef(dummyGR(), []string{t1, t2}, []string{t1, t2})

	// Simulate partial crash: only t1 renamed
	dialect := storagemigrator.NewDialect(env.store.GetSqlxSession().DriverName())
	_, err := env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("ALTER TABLE %s RENAME TO %s", dialect.Quote(t1), dialect.Quote(t1+legacySuffix)))
	require.NoError(t, err)

	sqlProvider := legacysql.NewDatabaseProvider(env.store)
	runner, m := newRunner(t, &mysqlTableLocker{sql: sqlProvider}, &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}, def)
	runMigration(t, env.store, runner, storagemigrator.MySQL)

	// Recovery restores tables, then full migration re-runs including rename
	m.AssertCalled(t, "Migrate", mock.Anything, mock.Anything)
	assertRenamed(t, env.store, t1, t2)
}

func TestIntegrationRecoverRenamedTables(t *testing.T) {
	env := newTestEnv(t)
	mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())

	type renamerSetup struct {
		name string
		make func(t *testing.T) MigrationTableRenamer
	}

	var setup renamerSetup
	if isTestDBMySQL() {
		setup = renamerSetup{
			name: "mysql",
			make: func(t *testing.T) MigrationTableRenamer {
				t.Helper()
				r := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
				r.Init(env.store.GetSqlxSession().SqlDB(), mg)
				return r // MySQL DDL auto-commits, no session needed
			},
		}
	} else {
		setup = renamerSetup{
			name: "transactional",
			make: func(t *testing.T) MigrationTableRenamer {
				t.Helper()
				r := &transactionalTableRenamer{log: logger}
				r.Init(env.store.GetSqlxSession().SqlDB(), mg)
				return r
			},
		}
	}

	t.Run(setup.name+"/normal state", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		renamer := setup.make(t)
		require.NoError(t, renamer.RecoverRenamedTables([]string{table}))
	})

	t.Run(setup.name+"/recovery — legacy exists, original missing", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		dialect := storagemigrator.NewDialect(env.store.GetSqlxSession().DriverName())
		_, err := env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("ALTER TABLE %s RENAME TO %s", dialect.Quote(table), dialect.Quote(table+legacySuffix)))
		require.NoError(t, err)

		renamer := setup.make(t)
		require.NoError(t, renamer.RecoverRenamedTables([]string{table}))

		// Recovery renames via mg.DBEngine (not sess), so the table is immediately
		// visible to other connections — which is required for migrators to read it.
		exists, err := storageq.TableExists(context.Background(), env.store.GetSqlxSession().SqlDB(), dialect, table)
		require.NoError(t, err)
		require.True(t, exists, "original table should be restored and visible via engine")
	})

	t.Run(setup.name+"/error — both exist", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		dialect := storagemigrator.NewDialect(env.store.GetSqlxSession().DriverName())
		_, err := env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", dialect.Quote(table+legacySuffix)))
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", dialect.Quote(table+legacySuffix)))
		})

		renamer := setup.make(t)
		err = renamer.RecoverRenamedTables([]string{table})
		require.Error(t, err)
		require.Contains(t, err.Error(), "both")
		require.Contains(t, err.Error(), "manual intervention")
	})

	t.Run(setup.name+"/error — neither exists", func(t *testing.T) {
		missing := "nonexistent_" + uuid.New().String()[:8]
		renamer := setup.make(t)
		err := renamer.RecoverRenamedTables([]string{missing})
		require.Error(t, err)
		require.Contains(t, err.Error(), "neither")
		require.Contains(t, err.Error(), "manual intervention")
	})
}

// TestIntegrationRun_SQLiteRetryReleasesLock verifies that MigrationRunner.Run's
// SQLite retry path (parquet buffer fallback) works correctly when the first
// migration attempt fails.
func TestIntegrationRun_SQLiteRetryReleasesLock(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !isTestDBSQLite() {
		t.Skip("SQLite-only")
	}

	env := newTestEnv(t)

	// Create a DB provider that shares the Grafana engine (required for SQLite tx sharing).
	eDB, err := dbimpl.ProvideResourceDB(env.store, setting.NewCfg(), nil)
	require.NoError(t, err)

	backend, err := sqlBackend.NewBackend(sqlBackend.BackendOptions{
		DBProvider: eDB,
		IsHA:       false,
	})
	require.NoError(t, err)

	ctx := testutil.NewTestContext(t, time.Now().Add(1*time.Minute))
	svc, ok := backend.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))
	t.Cleanup(func() {
		_ = services.StopAndAwaitTerminated(context.Background(), svc)
	})

	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend: backend,
	})
	require.NoError(t, err)

	client := resource.NewLocalResourceClient(server)

	gr := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	var callCount int32

	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          "test-retry",
		MigrationID: "test retry migration",
		Resources:   []ResourceInfo{{GroupResource: gr}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				n := atomic.AddInt32(&callCount, 1)
				if n == 1 {
					// First call: send a request to ensure the server enters its Recv()
					// loop and holds the bulk lock, then fail to simulate a SQLite cache spill.
					_ = stream.Send(&resourcepb.BulkRequest{
						Key: &resourcepb.ResourceKey{
							Namespace: opts.Namespace,
							Group:     gr.Group,
							Resource:  gr.Resource,
							Name:      "test-item",
						},
						Action: resourcepb.BulkRequest_ADDED,
						Value:  []byte(`{"apiVersion":"folder.grafana.app/v0alpha1","kind":"Folder","metadata":{"name":"test-item","namespace":"` + opts.Namespace + `"},"spec":{"title":"Test"}}`),
					})
					return fmt.Errorf("simulated SQLite cache spill failure")
				}
				return nil
			},
		},
	})

	realMigrator := ProvideUnifiedMigrator(client, registry)
	wrapped := &retryAwareMigrator{real: realMigrator}

	def := MigrationDefinition{
		ID:          "test-retry",
		MigrationID: "test retry migration",
		Resources:   []ResourceInfo{{GroupResource: gr}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
	}

	runnerCfg := setting.NewCfg()
	runner := NewMigrationRunner(wrapped, noopLocker(), &transactionalTableRenamer{log: logger}, runnerCfg, def, nil)

	mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
	tx, err := env.store.GetSqlxSession().SqlDB().BeginTx(context.Background(), nil)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()

	err = runner.Run(context.Background(), tx, mg, RunOptions{DriverName: storagemigrator.SQLite})
	require.NoError(t, err)
	require.NoError(t, tx.Commit())

	// The migrator func should have been called twice: once for the failed first attempt,
	// once for the successful retry.
	require.Equal(t, int32(2), atomic.LoadInt32(&callCount))
}

// retryAwareMigrator delegates Migrate to a real UnifiedMigrator and stubs
// RebuildIndexes. It waits briefly for the server to release the bulk lock.
type retryAwareMigrator struct {
	real      UnifiedMigrator
	callCount int32
}

func (m *retryAwareMigrator) Migrate(ctx context.Context, opts MigrateOptions) (*resourcepb.BulkResponse, error) {
	if atomic.AddInt32(&m.callCount, 1) > 1 {
		// The context cancellation propagates asynchronously to the server goroutine.
		// Wait briefly for it to release the bulk lock from the previous attempt.
		time.Sleep(200 * time.Millisecond)
	}
	return m.real.Migrate(ctx, opts)
}

func (m *retryAwareMigrator) RebuildIndexes(ctx context.Context, opts RebuildIndexOptions) error {
	return nil
}

func TestIntegrationBuildRenamePairs(t *testing.T) {
	env := newTestEnv(t)

	mg := storagemigrator.NewMigrator(env.store.GetSqlxSession())
	dialect := storagemigrator.NewDialect(env.store.GetSqlxSession().DriverName())

	t.Run("skips already renamed", func(t *testing.T) {
		name := fmt.Sprintf("test_crash_%s", uuid.New().String()[:8])
		_, err := env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", dialect.Quote(name+legacySuffix)))
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", dialect.Quote(name)))
			_, _ = env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", dialect.Quote(name+legacySuffix)))
		})
		pairs, err := buildRenamePairs(logger, mg, []string{name})
		require.NoError(t, err)
		require.Empty(t, pairs)
	})

	t.Run("returns pair for table needing rename", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		pairs, err := buildRenamePairs(logger, mg, []string{table})
		require.NoError(t, err)
		require.Len(t, pairs, 1)
		require.Equal(t, table, pairs[0].oldName)
	})

	t.Run("errors when both exist", func(t *testing.T) {
		table := uniqueTable(t, env.store)
		_, _ = env.store.GetSqlxSession().Exec(context.Background(), fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", dialect.Quote(table+legacySuffix)))
		_, err := buildRenamePairs(logger, mg, []string{table})
		require.Error(t, err)
		require.Contains(t, err.Error(), "unexpected state")
	})
}
