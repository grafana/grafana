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

type testEnv struct {
	engine *xorm.Engine
	store  db.DB
}

func newTestEnv(t *testing.T) testEnv {
	t.Helper()
	testutil.SkipIntegrationTestInShortMode(t)
	dbstore := db.InitTestDB(t)
	t.Cleanup(db.CleanupTestDB)
	ensureOrg(t, dbstore.GetEngine())
	return testEnv{engine: dbstore.GetEngine(), store: dbstore}
}

func uniqueTable(t *testing.T, engine *xorm.Engine) string {
	t.Helper()
	name := fmt.Sprintf("test_%s", uuid.New().String()[:8])
	_, err := engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY, val TEXT)", engine.Quote(name)))
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name)))
		_, _ = engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", engine.Quote(name+legacySuffix)))
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

func ensureOrg(t *testing.T, engine *xorm.Engine) {
	t.Helper()
	var count int64
	has, _ := engine.NewSession().SQL("SELECT COUNT(*) FROM org WHERE id = 1").Get(&count)
	if !has || count == 0 {
		_, err := engine.Exec("INSERT INTO org (id, name, created, updated, version) VALUES (1, 'test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)")
		require.NoError(t, err)
	}
}

func runMigration(t *testing.T, engine *xorm.Engine, runner *MigrationRunner, driverName string) {
	t.Helper()
	mg := migrator.NewMigrator(engine, setting.NewCfg())
	sess := engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())
	require.NoError(t, runner.Run(context.Background(), sess, mg, RunOptions{DriverName: driverName}))
	_ = sess.Commit()
}

func assertRenamed(t *testing.T, engine *xorm.Engine, tables ...string) {
	t.Helper()
	for _, table := range tables {
		exists, err := engine.IsTableExist(table)
		require.NoError(t, err)
		require.False(t, exists, "%s should be gone", table)
		exists, err = engine.IsTableExist(table + legacySuffix)
		require.NoError(t, err)
		require.True(t, exists, "%s_legacy should exist", table)
	}
}

func assertNotRenamed(t *testing.T, engine *xorm.Engine, table string) {
	t.Helper()
	exists, err := engine.IsTableExist(table)
	require.NoError(t, err)
	require.True(t, exists)
	exists, err = engine.IsTableExist(table + legacySuffix)
	require.NoError(t, err)
	require.False(t, exists)
}

func noopLocker() *tableLockerMock {
	return &tableLockerMock{unlockFunc: func(context.Context) error { return nil }}
}

func TestIntegrationRun_Postgres_LocksOnSession(t *testing.T) {
	env := newTestEnv(t)
	if !db.IsTestDbPostgres() {
		t.Skip("Postgres-only")
	}

	table := uniqueTable(t, env.engine)
	sqlProvider := legacysql.NewDatabaseProvider(env.store)
	runner, _ := newRunner(t, &postgresTableLocker{sql: sqlProvider}, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
	runMigration(t, env.engine, runner, migrator.Postgres)
}

func TestIntegrationRun_MySQL_UsesTableLocker(t *testing.T) {
	env := newTestEnv(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}

	table := uniqueTable(t, env.engine)
	unlockCalled := false
	locker := &tableLockerMock{unlockFunc: func(context.Context) error { unlockCalled = true; return nil }}
	runner, _ := newRunner(t, locker, &transactionalTableRenamer{log: logger}, testDef(dummyGR(), []string{table}, nil))
	runMigration(t, env.engine, runner, migrator.MySQL)

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
			skip: func() bool { return !db.IsTestDbPostgres() },
			locker: func() MigrationTableLocker {
				return &postgresTableLocker{sql: legacysql.NewDatabaseProvider(env.store)}
			},
			renamer:   func() MigrationTableRenamer { return &transactionalTableRenamer{log: logger} },
			numTables: 1, wantRenamed: true,
		},
		{
			name:      "SQLite",
			skip:      func() bool { return !db.IsTestDbSQLite() },
			locker:    func() MigrationTableLocker { return noopLocker() },
			renamer:   func() MigrationTableRenamer { return &transactionalTableRenamer{log: logger} },
			numTables: 1, wantRenamed: true,
		},
		{
			name:      "SQLite no rename configured",
			skip:      func() bool { return !db.IsTestDbSQLite() },
			locker:    func() MigrationTableLocker { return noopLocker() },
			renamer:   func() MigrationTableRenamer { return &transactionalTableRenamer{log: logger} },
			numTables: 1, wantRenamed: false,
		},
		{
			name: "MySQL multiple tables",
			skip: func() bool { return !db.IsTestDbMySQL() },
			locker: func() MigrationTableLocker {
				return &mysqlTableLocker{sql: legacysql.NewDatabaseProvider(env.store)}
			},
			renamer:   func() MigrationTableRenamer { return &mysqlTableRenamer{log: logger, waitDeadline: time.Minute} },
			numTables: 2, wantRenamed: true,
		},
		{
			name: "MySQL no rename configured",
			skip: func() bool { return !db.IsTestDbMySQL() },
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
				tables[i] = uniqueTable(t, env.engine)
			}

			var renameTables []string
			if tc.wantRenamed {
				renameTables = tables
			}

			runner, _ := newRunner(t, tc.locker(), tc.renamer(), testDef(dummyGR(), tables, renameTables))
			runMigration(t, env.engine, runner, env.engine.DriverName())

			if tc.wantRenamed {
				assertRenamed(t, env.engine, tables...)
			} else {
				assertNotRenamed(t, env.engine, tables[0])
			}
		})
	}
}

func TestIntegrationMySQL_WaitForRenamesQueued(t *testing.T) {
	env := newTestEnv(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}

	t.Run("single table detected", func(t *testing.T) {
		table := uniqueTable(t, env.engine)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
		mg := migrator.NewMigrator(env.engine, setting.NewCfg())

		sess := env.engine.NewSession()
		defer sess.Close()
		require.NoError(t, sess.Begin())
		renamer.Init(sess, mg)

		unlock, results := lockAndQueueRename(t, env.engine, []string{table})

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
		t1, t2 := uniqueTable(t, env.engine), uniqueTable(t, env.engine)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
		mg := migrator.NewMigrator(env.engine, setting.NewCfg())

		sess := env.engine.NewSession()
		defer sess.Close()
		require.NoError(t, sess.Begin())
		renamer.Init(sess, mg)

		unlock, results := lockAndQueueRename(t, env.engine, []string{t1, t2})
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
		t1, t2 := uniqueTable(t, env.engine), uniqueTable(t, env.engine)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: 500 * time.Millisecond}
		mg := migrator.NewMigrator(env.engine, setting.NewCfg())

		sess := env.engine.NewSession()
		defer sess.Close()
		require.NoError(t, sess.Begin())
		renamer.Init(sess, mg)

		unlock, results := lockAndQueueRename(t, env.engine, []string{t1, t2})

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
		table := uniqueTable(t, env.engine)
		renamer := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
		mg := migrator.NewMigrator(env.engine, setting.NewCfg())

		sess := env.engine.NewSession()
		defer sess.Close()
		require.NoError(t, sess.Begin())
		renamer.Init(sess, mg)

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
func lockAndQueueRename(t *testing.T, engine *xorm.Engine, tables []string) (unlock func(), results []<-chan error) {
	t.Helper()
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}

	lockConn, err := engine.DB().Conn(context.Background())
	require.NoError(t, err)

	// Build "t1 READ, t2 READ, ..." lock statement.
	lockStmt := ""
	for i, tbl := range tables {
		if i > 0 {
			lockStmt += ", "
		}
		lockStmt += engine.Quote(tbl) + " READ"
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
			conn, cerr := engine.DB().Conn(context.Background())
			if cerr != nil {
				ch <- cerr
				return
			}
			defer func() { _ = conn.Close() }()
			_, rerr := conn.ExecContext(context.Background(),
				fmt.Sprintf("RENAME TABLE %s TO %s", engine.Quote(tbl), engine.Quote(tbl+legacySuffix)))
			ch <- rerr
		}(tbl, ch)
	}
	return unlock, results
}

func TestIntegrationRunMySQL_CrashRecovery(t *testing.T) {
	env := newTestEnv(t)
	if !db.IsTestDbMySQL() {
		t.Skip("MySQL-only")
	}

	t1, t2 := uniqueTable(t, env.engine), uniqueTable(t, env.engine)
	def := testDef(dummyGR(), []string{t1, t2}, []string{t1, t2})

	// Simulate partial crash: only t1 renamed
	_, err := env.engine.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", env.engine.Quote(t1), env.engine.Quote(t1+legacySuffix)))
	require.NoError(t, err)

	sqlProvider := legacysql.NewDatabaseProvider(env.store)
	runner, m := newRunner(t, &mysqlTableLocker{sql: sqlProvider}, &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}, def)
	runMigration(t, env.engine, runner, migrator.MySQL)

	// Recovery restores tables, then full migration re-runs including rename
	m.AssertCalled(t, "Migrate", mock.Anything, mock.Anything)
	assertRenamed(t, env.engine, t1, t2)
}

func TestIntegrationRecoverRenamedTables(t *testing.T) {
	env := newTestEnv(t)
	mg := migrator.NewMigrator(env.engine, setting.NewCfg())

	type renamerSetup struct {
		name string
		make func(t *testing.T) MigrationTableRenamer
	}

	setups := []renamerSetup{
		{
			name: "transactional",
			make: func(t *testing.T) MigrationTableRenamer {
				t.Helper()
				r := &transactionalTableRenamer{log: logger}
				sess := env.engine.NewSession()
				t.Cleanup(func() { _ = sess.Rollback(); sess.Close() })
				require.NoError(t, sess.Begin())
				r.Init(sess, mg)
				return r
			},
		},
	}
	if db.IsTestDbMySQL() {
		setups = append(setups, renamerSetup{
			name: "mysql",
			make: func(t *testing.T) MigrationTableRenamer {
				t.Helper()
				r := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
				r.Init(nil, mg) // mysql renamer uses mg.DBEngine, not sess
				return r
			},
		})
	}

	for _, setup := range setups {
		t.Run(setup.name+"/normal state", func(t *testing.T) {
			table := uniqueTable(t, env.engine)
			require.NoError(t, setup.make(t).RecoverRenamedTables([]string{table}))
		})

		t.Run(setup.name+"/recovery — legacy exists, original missing", func(t *testing.T) {
			table := uniqueTable(t, env.engine)
			_, err := env.engine.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", env.engine.Quote(table), env.engine.Quote(table+legacySuffix)))
			require.NoError(t, err)

			require.NoError(t, setup.make(t).RecoverRenamedTables([]string{table}))

			exists, err := env.engine.IsTableExist(table)
			require.NoError(t, err)
			require.True(t, exists, "original table should be restored")
		})

		t.Run(setup.name+"/error — both exist", func(t *testing.T) {
			table := uniqueTable(t, env.engine)
			_, err := env.engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", env.engine.Quote(table+legacySuffix)))
			require.NoError(t, err)
			t.Cleanup(func() {
				_, _ = env.engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", env.engine.Quote(table+legacySuffix)))
			})

			err = setup.make(t).RecoverRenamedTables([]string{table})
			require.Error(t, err)
			require.Contains(t, err.Error(), "both")
			require.Contains(t, err.Error(), "manual intervention")
		})

		t.Run(setup.name+"/error — neither exists", func(t *testing.T) {
			missing := "nonexistent_" + uuid.New().String()[:8]
			err := setup.make(t).RecoverRenamedTables([]string{missing})
			require.Error(t, err)
			require.Contains(t, err.Error(), "neither")
			require.Contains(t, err.Error(), "manual intervention")
		})
	}
}

func TestIntegrationBuildRenamePairs(t *testing.T) {
	env := newTestEnv(t)

	mg := migrator.NewMigrator(env.engine, setting.NewCfg())

	t.Run("skips already renamed", func(t *testing.T) {
		name := fmt.Sprintf("test_crash_%s", uuid.New().String()[:8])
		_, err := env.engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", env.engine.Quote(name+legacySuffix)))
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = env.engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", env.engine.Quote(name)))
			_, _ = env.engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", env.engine.Quote(name+legacySuffix)))
		})
		pairs, err := buildRenamePairs(logger, mg, []string{name})
		require.NoError(t, err)
		require.Empty(t, pairs)
	})

	t.Run("returns pair for table needing rename", func(t *testing.T) {
		table := uniqueTable(t, env.engine)
		pairs, err := buildRenamePairs(logger, mg, []string{table})
		require.NoError(t, err)
		require.Len(t, pairs, 1)
		require.Equal(t, table, pairs[0].oldName)
	})

	t.Run("errors when both exist", func(t *testing.T) {
		table := uniqueTable(t, env.engine)
		_, _ = env.engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", env.engine.Quote(table+legacySuffix)))
		_, err := buildRenamePairs(logger, mg, []string{table})
		require.Error(t, err)
		require.Contains(t, err.Error(), "unexpected state")
	})
}
