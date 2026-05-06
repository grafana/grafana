package migrations

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	sqlBackend "github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/util/xorm"
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

func newRunner(t *testing.T, locker MigrationTableLocker, renamer MigrationTableRenamer, def MigrationDefinition) (*MigrationRunner, *fakeUnifiedMigrator) {
	t.Helper()
	fake := &fakeUnifiedMigrator{
		migrateResponse: &resourcepb.BulkResponse{},
	}
	return NewMigrationRunner(fake, locker, renamer, setting.NewCfg(), def, nil), fake
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
	require.Greater(t, m.migrateCalled, 0)
	assertRenamed(t, env.engine, t1, t2)
}

func TestIntegrationRecoverRenamedTables(t *testing.T) {
	env := newTestEnv(t)
	mg := migrator.NewMigrator(env.engine, setting.NewCfg())

	type renamerSetup struct {
		name string
		make func(t *testing.T) MigrationTableRenamer
	}

	var setup renamerSetup
	if db.IsTestDbMySQL() {
		setup = renamerSetup{
			name: "mysql",
			make: func(t *testing.T) MigrationTableRenamer {
				t.Helper()
				r := &mysqlTableRenamer{log: logger, waitDeadline: time.Minute}
				r.Init(nil, mg)
				return r // MySQL DDL auto-commits, no session needed
			},
		}
	} else {
		setup = renamerSetup{
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
		}
	}

	t.Run(setup.name+"/normal state", func(t *testing.T) {
		table := uniqueTable(t, env.engine)
		renamer := setup.make(t)
		require.NoError(t, renamer.RecoverRenamedTables([]string{table}))
	})

	t.Run(setup.name+"/recovery — legacy exists, original missing", func(t *testing.T) {
		table := uniqueTable(t, env.engine)
		_, err := env.engine.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", env.engine.Quote(table), env.engine.Quote(table+legacySuffix)))
		require.NoError(t, err)

		renamer := setup.make(t)
		require.NoError(t, renamer.RecoverRenamedTables([]string{table}))

		// Recovery renames via mg.DBEngine (not sess), so the table is immediately
		// visible to other connections — which is required for migrators to read it.
		exists, err := env.engine.IsTableExist(table)
		require.NoError(t, err)
		require.True(t, exists, "original table should be restored and visible via engine")
	})

	t.Run(setup.name+"/error — both exist", func(t *testing.T) {
		table := uniqueTable(t, env.engine)
		_, err := env.engine.Exec(fmt.Sprintf("CREATE TABLE %s (id INT PRIMARY KEY)", env.engine.Quote(table+legacySuffix)))
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = env.engine.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", env.engine.Quote(table+legacySuffix)))
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
// migration attempt fails. It runs for both SQL and KV backends.
func TestIntegrationRun_SQLiteRetryReleasesLock(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("SQLite-only")
	}

	t.Run("SQL", func(t *testing.T) {
		env := newTestEnv(t)
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

		testSQLiteRetryReleasesLock(t, env, backend, "test-retry", true)
	})

	t.Run("KV", func(t *testing.T) {
		env := newTestEnv(t)
		eDB, err := dbimpl.ProvideResourceDB(env.store, setting.NewCfg(), nil)
		require.NoError(t, err)

		resDB, err := eDB.Init(context.Background())
		require.NoError(t, err)

		kvStore, err := kv.NewSQLKV(resDB.SqlDB(), resDB.DriverName())
		require.NoError(t, err)

		rvMgr, err := rvmanager.NewResourceVersionManager(rvmanager.ResourceManagerOptions{
			Dialect: sqltemplate.SQLite,
			DB:      resDB,
		})
		require.NoError(t, err)

		backend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
			KvStore:       kvStore,
			RvManager:     rvMgr,
			DBKeepAlive:   eDB,
			DisablePruner: true,
			Log:           log.New("test.kv.retry"),
		})
		require.NoError(t, err)

		testSQLiteRetryReleasesLock(t, env, backend, "test-retry-kv", false)
	})
}

func testSQLiteRetryReleasesLock(t *testing.T, env testEnv, backend resource.StorageBackend, id string, expectRebuild bool) {
	t.Helper()

	server, err := newRetryTestResourceServerWithSearch(t, backend)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = server.Stop(context.Background())
	})

	client := &recordingRetryResourceClient{
		ResourceClient: resource.NewLocalResourceClient(server),
	}

	gr := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	var callCount int32

	openTestSearchIndex(t, client, gr)

	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          id,
		MigrationID: id,
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
		ID:          id,
		MigrationID: id,
		Resources:   []ResourceInfo{{GroupResource: gr}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
	}

	runnerCfg := setting.NewCfg()
	runner := NewMigrationRunner(wrapped, noopLocker(), &transactionalTableRenamer{log: logger}, runnerCfg, def, nil)

	mg := migrator.NewMigrator(env.engine, setting.NewCfg())
	sess := env.engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())

	err = runner.Run(context.Background(), sess, mg, RunOptions{DriverName: migrator.SQLite})
	require.NoError(t, err)

	// The migrator func should have been called twice: once for the failed first attempt,
	// once for the successful retry.
	require.Equal(t, int32(2), atomic.LoadInt32(&callCount))
	require.NotNil(t, client.lastRebuildResponse, "expected real RebuildIndexes call")
	require.Nil(t, client.lastRebuildResponse.Error)
	if expectRebuild {
		require.EqualValues(t, 1, client.lastRebuildResponse.RebuildCount)
	}
}

func newRetryTestResourceServerWithSearch(t *testing.T, backend resource.StorageBackend) (resource.ResourceServer, error) {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.EnableSearch = true
	cfg.IndexFileThreshold = 1000
	cfg.IndexPath = t.TempDir()
	cfg.DisablePruner = true

	docBuilders := &resource.TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"folder.grafana.app": "folders",
		},
	}

	searchOpts, err := search.NewSearchOptions(featuremgmt.WithFeatures(), cfg, docBuilders, nil, nil)
	require.NoError(t, err)

	return resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      backend,
		AccessClient: authlib.FixedAccessClient(true),
		Search:       searchOpts,
	})
}

func openTestSearchIndex(t *testing.T, client resource.ResourceClient, gr schema.GroupResource) {
	t.Helper()

	searchCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		Type:    authlib.TypeUser,
		UserID:  1,
		UserUID: "user-uid-1",
		OrgID:   1,
		OrgRole: identity.RoleAdmin,
		Login:   "testuser",
		Name:    "Test User",
	})

	// Open the index before the migration so RebuildIndexes has a real index to rebuild.
	searchResp, err := client.Search(searchCtx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     gr.Group,
				Resource:  gr.Resource,
			},
		},
	})
	require.NoError(t, err)
	require.Nil(t, searchResp.Error)
}

type recordingRetryResourceClient struct {
	resource.ResourceClient
	lastRebuildResponse *resourcepb.RebuildIndexesResponse
}

func (c *recordingRetryResourceClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	resp, err := c.ResourceClient.RebuildIndexes(ctx, in, opts...)
	c.lastRebuildResponse = resp
	return resp, err
}

// retryAwareMigrator delegates both Migrate and RebuildIndexes to a real UnifiedMigrator.
// It waits briefly before retrying Migrate so the server releases the bulk lock.
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
	return m.real.RebuildIndexes(ctx, opts)
}

func TestIntegrationRun_SQLiteLargeMigrationRebuildUsesMigrationTransaction(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	if !db.IsTestDbSQLite() {
		t.Skip("SQLite-only")
	}

	env := newTestEnv(t)
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

	server, err := newRetryTestResourceServerWithSearch(t, backend)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = server.Stop(context.Background())
	})

	client := &recordingRetryResourceClient{
		ResourceClient: resource.NewLocalResourceClient(server),
	}

	gr := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	openTestSearchIndex(t, client, gr)

	largeTitle := strings.Repeat("x", 256*1024)
	registry := NewMigrationRegistry()
	registry.Register(MigrationDefinition{
		ID:          "sqlite-large-rebuild-busy",
		MigrationID: "sqlite-large-rebuild-busy",
		Resources:   []ResourceInfo{{GroupResource: gr}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(ctx context.Context, orgId int64, opts MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error {
				for i := 0; i < 16; i++ {
					err := stream.Send(&resourcepb.BulkRequest{
						Key: &resourcepb.ResourceKey{
							Namespace: opts.Namespace,
							Group:     gr.Group,
							Resource:  gr.Resource,
							Name:      fmt.Sprintf("large-item-%d", i),
						},
						Action: resourcepb.BulkRequest_ADDED,
						Value: []byte(fmt.Sprintf(`{"apiVersion":"folder.grafana.app/v0alpha1","kind":"Folder","metadata":{"name":"large-item-%d","namespace":"%s"},"spec":{"title":"%s"}}`,
							i, opts.Namespace, largeTitle)),
					})
					if err != nil {
						return err
					}
				}
				return nil
			},
		},
	})

	realMigrator := ProvideUnifiedMigrator(client, registry)
	def := MigrationDefinition{
		ID:          "sqlite-large-rebuild-busy",
		MigrationID: "sqlite-large-rebuild-busy",
		Resources:   []ResourceInfo{{GroupResource: gr}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
	}

	runnerCfg := setting.NewCfg()
	runnerCfg.MigrationCacheSizeKB = 1
	runner := NewMigrationRunner(realMigrator, noopLocker(), &transactionalTableRenamer{log: logger}, runnerCfg, def, nil)

	mg := migrator.NewMigrator(env.engine, setting.NewCfg())
	sess := env.engine.NewSession()
	defer sess.Close()
	require.NoError(t, sess.Begin())

	runCtx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))
	err = runner.Run(runCtx, sess, mg, RunOptions{DriverName: migrator.SQLite})
	require.NoError(t, err)
	require.NotNil(t, client.lastRebuildResponse)
	require.Nil(t, client.lastRebuildResponse.Error)
	require.EqualValues(t, 1, client.lastRebuildResponse.RebuildCount)
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

func TestIntegrationIsAlreadyOnUnifiedStorage(t *testing.T) {
	env := newTestEnv(t)

	gr := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	def := MigrationDefinition{
		ID: FoldersDashboardsMigrationID, MigrationID: "folders and dashboards migration",
		Resources: []ResourceInfo{{GroupResource: gr}},
		Migrators: map[schema.GroupResource]MigratorFunc{
			gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
		},
	}

	insertKVState := func(t *testing.T, key string, status dualwriteStorageStatus) {
		t.Helper()
		orgID := int64(0)
		ns := dualwriteKVNamespace
		value, err := json.Marshal(status)
		require.NoError(t, err)
		item := kvstore.Item{
			OrgId:     &orgID,
			Namespace: &ns,
			Key:       &key,
		}
		sess := env.engine.NewSession()
		defer sess.Close()
		// delete any existing entry first
		_, _ = sess.Delete(&item)
		now := time.Now()
		item.Value = string(value)
		item.Created = now
		item.Updated = now
		_, err = sess.Insert(&item)
		require.NoError(t, err)
	}

	deleteKVState := func(t *testing.T, key string) {
		t.Helper()
		orgID := int64(0)
		ns := dualwriteKVNamespace
		item := kvstore.Item{
			OrgId:     &orgID,
			Namespace: &ns,
			Key:       &key,
		}
		sess := env.engine.NewSession()
		defer sess.Close()
		_, _ = sess.Delete(&item)
	}

	writeDualwriteFile := func(t *testing.T, dataPath string, statuses map[string]dualwriteStorageStatus) {
		t.Helper()
		require.NoError(t, os.MkdirAll(dataPath, 0750))
		data, err := json.Marshal(statuses)
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(filepath.Join(dataPath, dualwriteFileName), data, 0600))
	}

	newSession := func() *xorm.Session {
		return env.engine.NewSession()
	}

	newRunnerWithDataPath := func(t *testing.T, dataPath string) *MigrationRunner {
		t.Helper()
		cfg := setting.NewCfg()
		cfg.DataPath = dataPath
		fake := &fakeUnifiedMigrator{migrateResponse: &resourcepb.BulkResponse{}}
		return NewMigrationRunner(fake, noopLocker(), &transactionalTableRenamer{log: logger}, cfg, def, nil)
	}

	runner, _ := newRunner(t, noopLocker(), &transactionalTableRenamer{log: logger}, def)
	configKey := def.ConfigResources()[0] // "dashboards.dashboard.grafana.app"

	migratedStatus := dualwriteStorageStatus{
		ReadUnified:  true,
		WriteUnified: true,
		WriteLegacy:  false,
		Migrated:     1776363974703,
	}

	t.Run("returns false when no kv_store entry exists", func(t *testing.T) {
		deleteKVState(t, configKey)
		sess := newSession()
		defer sess.Close()
		got, err := runner.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("returns false for non-folders-dashboards definitions even when kv_store shows migrated", func(t *testing.T) {
		insertKVState(t, configKey, migratedStatus)
		otherDef := MigrationDefinition{
			ID: "shorturls", MigrationID: "shorturls migration",
			Resources: []ResourceInfo{{GroupResource: gr}},
			Migrators: map[schema.GroupResource]MigratorFunc{
				gr: func(context.Context, int64, MigrateOptions, resourcepb.BulkStore_BulkProcessClient) error { return nil },
			},
		}
		otherRunner, _ := newRunner(t, noopLocker(), &transactionalTableRenamer{log: logger}, otherDef)
		sess := newSession()
		defer sess.Close()
		got, err := otherRunner.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("returns false when read_unified is false", func(t *testing.T) {
		insertKVState(t, configKey, dualwriteStorageStatus{ReadUnified: false, WriteUnified: true, Migrated: 1234})
		sess := newSession()
		defer sess.Close()
		got, err := runner.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("returns false when migrated is zero", func(t *testing.T) {
		insertKVState(t, configKey, dualwriteStorageStatus{ReadUnified: true, WriteUnified: true, Migrated: 0})
		sess := newSession()
		defer sess.Close()
		got, err := runner.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("returns false when write_legacy is true", func(t *testing.T) {
		insertKVState(t, configKey, dualwriteStorageStatus{ReadUnified: true, WriteUnified: true, WriteLegacy: true, Migrated: 1234})
		sess := newSession()
		defer sess.Close()
		got, err := runner.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("returns true when kv_store status shows migration complete", func(t *testing.T) {
		insertKVState(t, configKey, migratedStatus)
		sess := newSession()
		defer sess.Close()
		got, err := runner.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.True(t, got)
	})

	t.Run("returns true when dualwrite.json file shows migration complete", func(t *testing.T) {
		deleteKVState(t, configKey)
		dataPath := t.TempDir()
		writeDualwriteFile(t, dataPath, map[string]dualwriteStorageStatus{configKey: migratedStatus})
		r := newRunnerWithDataPath(t, dataPath)
		sess := newSession()
		defer sess.Close()
		got, err := r.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.True(t, got)
	})

	t.Run("returns false when dualwrite.json shows migration not complete", func(t *testing.T) {
		deleteKVState(t, configKey)
		dataPath := t.TempDir()
		writeDualwriteFile(t, dataPath, map[string]dualwriteStorageStatus{
			configKey: {ReadUnified: false, WriteUnified: true, WriteLegacy: true, Migrated: 0},
		})
		r := newRunnerWithDataPath(t, dataPath)
		sess := newSession()
		defer sess.Close()
		got, err := r.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("dualwrite.json takes precedence over kv_store for the same key", func(t *testing.T) {
		insertKVState(t, configKey, migratedStatus)
		dataPath := t.TempDir()
		writeDualwriteFile(t, dataPath, map[string]dualwriteStorageStatus{
			configKey: {ReadUnified: false, WriteUnified: true, WriteLegacy: true, Migrated: 0},
		})
		r := newRunnerWithDataPath(t, dataPath)
		sess := newSession()
		defer sess.Close()
		got, err := r.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("falls back to kv_store when key is missing from dualwrite.json", func(t *testing.T) {
		insertKVState(t, configKey, migratedStatus)
		dataPath := t.TempDir()
		writeDualwriteFile(t, dataPath, map[string]dualwriteStorageStatus{
			"something.else": {ReadUnified: true, WriteUnified: true, Migrated: 1},
		})
		r := newRunnerWithDataPath(t, dataPath)
		sess := newSession()
		defer sess.Close()
		got, err := r.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.True(t, got)
	})

	t.Run("returns false when dualwrite.json does not exist and no kv_store entry", func(t *testing.T) {
		deleteKVState(t, configKey)
		dataPath := t.TempDir() // directory exists but no dualwrite.json in it
		r := newRunnerWithDataPath(t, dataPath)
		sess := newSession()
		defer sess.Close()
		got, err := r.isAlreadyOnUnifiedStorage(sess)
		require.NoError(t, err)
		require.False(t, got)
	})

	t.Run("Run skips migration when already on unified storage", func(t *testing.T) {
		insertKVState(t, configKey, migratedStatus)
		runner2, fake := newRunner(t, noopLocker(), &transactionalTableRenamer{log: logger}, def)
		runMigration(t, env.engine, runner2, migrator.SQLite)
		require.Equal(t, 0, fake.migrateCalled, "Migrate should not be called when already on unified storage")
	})

	t.Run("Run proceeds with migration when not on unified storage", func(t *testing.T) {
		insertKVState(t, configKey, dualwriteStorageStatus{ReadUnified: false, WriteUnified: false, Migrated: 0})
		runner2, fake := newRunner(t, noopLocker(), &transactionalTableRenamer{log: logger}, def)
		runMigration(t, env.engine, runner2, migrator.SQLite)
		require.Equal(t, 1, fake.migrateCalled, "Migrate should be called when not on unified storage")
	})
}
