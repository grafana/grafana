package migrations

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/golang-migrate/migrate/v4/database"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/util/xorm"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

func TestMigrations(t *testing.T) {
	testDB, err := sqlutil.GetTestDB(SQLite)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	const query = `select count(*) as count from migration_log`
	result := struct{ Count int }{}

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			t.Logf("failed to close xorm engine: %v", err)
		}
	})

	err = NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	_, err = x.SQL(query).Get(&result)
	require.Error(t, err)

	mg := NewMigrator(x, &setting.Cfg{Raw: ini.Empty()})
	migrations := &OSSMigrations{}
	migrations.AddMigration(mg)
	expectedMigrations := mg.GetMigrationIDs(true)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	has, err := x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)

	checkStepsAndDatabaseMatch(t, mg, expectedMigrations)

	mg = NewMigrator(x, &setting.Cfg{})
	migrations.AddMigration(mg)

	err = mg.Start(false, 0)
	require.NoError(t, err)

	has, err = x.SQL(query).Get(&result)
	require.NoError(t, err)
	require.True(t, has)
	checkStepsAndDatabaseMatch(t, mg, expectedMigrations)
}

func TestIntegrationMigrationLock(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	dbType := sqlutil.GetTestDBType()
	// skip for SQLite since there is no database locking (only migrator locking)
	if dbType == SQLite {
		t.Skip()
	}

	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			t.Logf("failed to close xorm engine: %v", err)
		}
	})

	dialect := NewDialect(x.DriverName())

	sess := x.NewSession()
	t.Cleanup(func() {
		sess.Close()
	})

	key, err := database.GenerateAdvisoryLockId("test")
	require.NoError(t, err)

	cfg := LockCfg{
		Session: sess,
		Key:     key,
	}

	t.Run("obtaining lock should succeed", func(t *testing.T) {
		err := dialect.Lock(cfg)
		require.NoError(t, err)

		t.Run("releasing previously obtained lock should succeed", func(t *testing.T) {
			err := dialect.Unlock(cfg)
			require.NoError(t, err)

			t.Run("releasing already released lock should fail", func(t *testing.T) {
				err := dialect.Unlock(cfg)
				require.Error(t, err)
				assert.ErrorIs(t, err, ErrReleaseLockDB)
			})
		})
	})

	t.Run("obtaining lock twice should succeed", func(t *testing.T) {
		err = dialect.Lock(cfg)
		require.NoError(t, err)

		err = dialect.Lock(cfg)
		require.NoError(t, err)

		t.Cleanup(func() {
			err := dialect.Unlock(cfg)
			require.NoError(t, err)

			err = dialect.Unlock(cfg)
			require.NoError(t, err)
		})
	})

	t.Run("obtaining same lock from another session should fail", func(t *testing.T) {
		x2, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
		require.NoError(t, err)
		sess2 := x2.NewSession()

		d2 := NewDialect(x2.DriverName())

		err = dialect.Lock(cfg)
		require.NoError(t, err)

		err = d2.Lock(LockCfg{Session: sess2, Key: key})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrLockDB)

		t.Cleanup(func() {
			err := dialect.Unlock(cfg)
			require.NoError(t, err)
		})
	})

	t.Run("obtaining lock for a another database should succeed", func(t *testing.T) {
		err := dialect.Lock(cfg)
		require.NoError(t, err)

		x, err := xorm.NewEngine(testDB.DriverName, replaceDBName(t, testDB.ConnStr, dbType))
		require.NoError(t, err)

		d := NewDialect(x.DriverName())
		err = d.Lock(cfg)
		require.NoError(t, err)

		t.Cleanup(func() {
			err := dialect.Unlock(cfg)
			require.NoError(t, err)

			err = d.Unlock(cfg)
			require.NoError(t, err)
		})
	})
}

func TestMigratorLocking(t *testing.T) {
	dbType := sqlutil.GetTestDBType()

	// skip for SQLite for now since it occasionally fails for not clear reason
	// anyway starting migrations concurretly for the same migrator is impossible use case
	if dbType == SQLite {
		t.Skip()
	}

	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			t.Logf("failed to close xorm engine: %v", err)
		}
	})

	err = NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg := NewMigrator(x, &setting.Cfg{})
	migrations := &OSSMigrations{}
	migrations.AddMigration(mg)

	var errorNum int64
	t.Run("when concurrent migrations for the same migrator occur, the second one should fail", func(t *testing.T) {
		for i := 0; i < 2; i++ {
			i := i // capture i variable
			t.Run(fmt.Sprintf("run migration %d", i), func(t *testing.T) {
				t.Parallel()
				err := mg.Start(true, 0)
				if err != nil {
					if errors.Is(err, ErrMigratorIsLocked) {
						atomic.AddInt64(&errorNum, 1)
					}
				}
			})
		}
	})
	assert.Equal(t, int64(1), atomic.LoadInt64(&errorNum))
}

func TestDatabaseLocking(t *testing.T) {
	dbType := sqlutil.GetTestDBType()

	// skip for SQLite since there is no database locking (only migrator locking)
	if dbType == SQLite {
		t.Skip()
	}

	testDB, err := sqlutil.GetTestDB(dbType)
	require.NoError(t, err)

	t.Cleanup(testDB.Cleanup)

	x, err := xorm.NewEngine(testDB.DriverName, testDB.ConnStr)
	require.NoError(t, err)

	t.Cleanup(func() {
		if err := x.Close(); err != nil {
			t.Logf("failed to close xorm engine: %v", err)
		}
	})

	err = NewDialect(x.DriverName()).CleanDB(x)
	require.NoError(t, err)

	mg1 := NewMigrator(x, &setting.Cfg{})
	migrations := &OSSMigrations{}
	migrations.AddMigration(mg1)
	reg := registry{
		migrators: make(map[int]*Migrator, 2),
	}
	reg.set(0, mg1)

	mg2 := NewMigrator(x, &setting.Cfg{})
	migrations.AddMigration(mg2)
	reg.set(1, mg2)

	var errorNum int64
	t.Run("when concurrent migrations occur for different migrators occur, the second one should fail", func(t *testing.T) {
		for i := 0; i < 2; i++ {
			i := i // capture i variable
			t.Run(fmt.Sprintf("run migration %d", i), func(t *testing.T) {
				mg, err := reg.get(i)
				require.NoError(t, err)
				t.Parallel()
				err = mg.Start(true, 0)
				if err != nil {
					assert.ErrorIs(t, err, ErrLockDB)
					if errors.Is(err, ErrLockDB) {
						atomic.AddInt64(&errorNum, 1)
					}
				}
			})
		}
	})
	assert.Equal(t, int64(1), errorNum)
}

func checkStepsAndDatabaseMatch(t *testing.T, mg *Migrator, expected []string) {
	t.Helper()
	log, err := mg.GetMigrationLog()
	require.NoError(t, err)
	missing := make([]string, 0)
	for _, id := range expected {
		_, ok := log[id]
		if !ok {
			missing = append(missing, id)
		}
	}
	notIntended := make([]string, 0)
	for logId := range log {
		found := false
		for _, s := range expected {
			found = s == logId
			if found {
				break
			}
		}
		if !found {
			notIntended = append(notIntended, logId)
		}
	}

	if len(missing) == 0 && len(notIntended) == 0 {
		return
	}

	var msg string
	if len(missing) > 0 {
		msg = fmt.Sprintf("was not executed [%v], ", strings.Join(missing, ", "))
	}
	if len(notIntended) > 0 {
		msg += fmt.Sprintf("executed but should not [%v]", strings.Join(notIntended, ", "))
	}
	require.Failf(t, "the number of migrations does not match log in database", msg)
}

func replaceDBName(t *testing.T, connStr, dbType string) string {
	switch dbType {
	case "mysql":
		cfg, err := mysql.ParseDSN(connStr)
		require.NoError(t, err)
		cfg.DBName = "grafana_ds_tests"
		return cfg.FormatDSN()
	case "postgres":
		return strings.Replace(connStr, "dbname=grafanatest", "dbname=grafanadstest", 1)
	default:
		return connStr
	}
}

type registry struct {
	mu        sync.Mutex
	migrators map[int]*Migrator
}

func (r *registry) get(i int) (*Migrator, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	m, ok := r.migrators[i]
	if !ok {
		return nil, fmt.Errorf("invalid index: %d", i)
	}
	return m, nil
}

func (r *registry) set(i int, mg *Migrator) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.migrators[i] = mg
}
