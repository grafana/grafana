package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/atomic"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrMigratorIsLocked   = fmt.Errorf("migrator is locked")
	ErrMigratorIsUnlocked = fmt.Errorf("migrator is unlocked")
)

type sessionProvider = func() *session.SessionDB

type Migrator struct {
	sessionGetter sessionProvider
	DBEngine      *xorm.Engine
	Dialect       Dialect
	migrations    []Migration
	migrationIds  map[string]struct{}
	Logger        log.Logger
	Cfg           *setting.Cfg
	isLocked      atomic.Bool
	version       string
}

type MigrationLog struct {
	Id          int64
	MigrationID string `xorm:"migration_id" db:"migration_id"`
	SQL         string `xorm:"sql" db:"sql"`
	Success     bool
	Error       string
	Timestamp   time.Time
	Version     sql.NullString // version when the process ran
}

func NewMigrator(engine *xorm.Engine, sessionGetter sessionProvider, cfg *setting.Cfg) *Migrator {
	mg := &Migrator{
		sessionGetter: sessionGetter,
		version:       fmt.Sprintf(`%s v%s (%s)`, setting.ApplicationName, setting.BuildVersion, setting.BuildCommit),
	}
	mg.DBEngine = engine
	mg.Logger = log.New("migrator")
	mg.migrations = make([]Migration, 0)
	mg.migrationIds = make(map[string]struct{})
	mg.Dialect = NewDialect(mg.DBEngine)
	mg.Cfg = cfg
	return mg
}

func (mg *Migrator) MigrationsCount() int {
	return len(mg.migrations)
}

func (mg *Migrator) AddMigration(id string, m Migration) {
	if _, ok := mg.migrationIds[id]; ok {
		panic(fmt.Sprintf("migration id conflict: %s", id))
	}

	m.SetId(id)
	mg.migrations = append(mg.migrations, m)
	mg.migrationIds[id] = struct{}{}
}

func (mg *Migrator) GetMigrationIDs(excludeNotLogged bool) []string {
	result := make([]string, 0, len(mg.migrations))
	for _, migration := range mg.migrations {
		if migration.SkipMigrationLog() && excludeNotLogged {
			continue
		}
		result = append(result, migration.Id())
	}
	return result
}

func (mg *Migrator) GetMigrationLog() (map[string]MigrationLog, error) {
	logMap := make(map[string]MigrationLog)
	logItems := make([]MigrationLog, 0)

	exists, err := mg.DBEngine.IsTableExist(new(MigrationLog))
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to check table existence", err)
	}
	if !exists {
		return logMap, nil
	}

	err = mg.sessionGetter().Select(context.Background(), &logItems, "SELECT * FROM migration_log")
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "unable to read migration_log", err)
	}

	for _, logItem := range logItems {
		if !logItem.Success {
			continue
		}
		logMap[logItem.MigrationID] = logItem
	}

	return logMap, nil
}

func (mg *Migrator) Start(isDatabaseLockingEnabled bool, lockAttemptTimeout int) (err error) {
	if !isDatabaseLockingEnabled {
		return mg.run()
	}

	return mg.InTransaction(func(sess *xorm.Session) error {
		mg.Logger.Info("Locking database")
		if err := casRestoreOnErr(&mg.isLocked, false, true, ErrMigratorIsLocked, mg.Dialect.Lock, LockCfg{Session: sess, Timeout: lockAttemptTimeout}); err != nil {
			mg.Logger.Error("Failed to lock database", "error", err)
			return err
		}

		defer func() {
			mg.Logger.Info("Unlocking database")
			unlockErr := casRestoreOnErr(&mg.isLocked, true, false, ErrMigratorIsUnlocked, mg.Dialect.Unlock, LockCfg{Session: sess})
			if unlockErr != nil {
				mg.Logger.Error("Failed to unlock database", "error", unlockErr)
			}
		}()

		// migration will run inside a nested transaction
		return mg.run()
	})
}

func (mg *Migrator) run() (err error) {
	mg.Logger.Info("Starting DB migrations")

	logMap, err := mg.GetMigrationLog()
	if err != nil {
		return err
	}

	version := sql.NullString{String: mg.version}
	migrationsPerformed := 0
	migrationsSkipped := 0
	start := time.Now()
	for _, m := range mg.migrations {
		m := m
		_, exists := logMap[m.Id()]
		if exists {
			mg.Logger.Debug("Skipping migration: Already executed", "id", m.Id())
			migrationsSkipped++
			continue
		}

		sql := m.SQL(mg.Dialect)

		record := MigrationLog{
			MigrationID: m.Id(),
			SQL:         sql,
			Timestamp:   time.Now(),
			Version:     version,
		}

		err := mg.InTransaction(func(sess *xorm.Session) error {
			err := mg.exec(m, sess)
			if err != nil {
				mg.Logger.Error("Exec failed", "error", err, "sql", sql)
				record.Error = err.Error()
				if !m.SkipMigrationLog() {
					if _, err := sess.Insert(&record); err != nil {
						return err
					}
				}
				return err
			}
			record.Success = true
			if !m.SkipMigrationLog() {
				_, err = sess.Insert(&record)
			}
			if err == nil {
				migrationsPerformed++
			}
			return err
		})
		if err != nil {
			return fmt.Errorf("%v: %w", fmt.Sprintf("migration failed (id = %s)", m.Id()), err)
		}
	}

	mg.Logger.Info("migrations completed", "performed", migrationsPerformed, "skipped", migrationsSkipped, "duration", time.Since(start))

	// Make sure migrations are synced
	return mg.DBEngine.Sync2()
}

func (mg *Migrator) exec(m Migration, sess *xorm.Session) error {
	mg.Logger.Info("Executing migration", "id", m.Id())

	condition := m.GetCondition()
	if condition != nil {
		sql, args := condition.SQL(mg.Dialect)

		if sql != "" {
			mg.Logger.Debug("Executing migration condition SQL", "id", m.Id(), "sql", sql, "args", args)
			results, err := sess.SQL(sql, args...).Query()
			if err != nil {
				mg.Logger.Error("Executing migration condition failed", "id", m.Id(), "error", err)
				return err
			}

			if !condition.IsFulfilled(results) {
				mg.Logger.Warn("Skipping migration: Already executed, but not recorded in migration log", "id", m.Id())
				return nil
			}
		}
	}

	var err error
	if codeMigration, ok := m.(CodeMigration); ok {
		mg.Logger.Debug("Executing code migration", "id", m.Id())
		err = codeMigration.Exec(sess, mg)
	} else {
		sql := m.SQL(mg.Dialect)
		mg.Logger.Debug("Executing sql migration", "id", m.Id(), "sql", sql)
		_, err = sess.Exec(sql)
	}

	if err != nil {
		mg.Logger.Error("Executing migration failed", "id", m.Id(), "error", err)
		return err
	}

	return nil
}

type dbTransactionFunc func(sess *xorm.Session) error

func (mg *Migrator) InTransaction(callback dbTransactionFunc) error {
	sess := mg.DBEngine.NewSession()
	defer sess.Close()

	if err := sess.Begin(); err != nil {
		return err
	}

	if err := callback(sess); err != nil {
		if rollErr := sess.Rollback(); rollErr != nil {
			return fmt.Errorf("failed to roll back transaction due to error: %s: %w", rollErr, err)
		}

		return err
	}

	if err := sess.Commit(); err != nil {
		return err
	}

	return nil
}

func casRestoreOnErr(lock *atomic.Bool, o, n bool, casErr error, f func(LockCfg) error, lockCfg LockCfg) error {
	if !lock.CompareAndSwap(o, n) {
		return casErr
	}
	if err := f(lockCfg); err != nil {
		// Automatically unlock/lock on error
		lock.Store(o)
		return err
	}
	return nil
}
