package migrator

import (
	"context"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-migrate/migrate/v4/database"
	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/atomic"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrMigratorIsLocked   = fmt.Errorf("migrator is locked")
	ErrMigratorIsUnlocked = fmt.Errorf("migrator is unlocked")
)

type Migrator struct {
	DBEngine     *xorm.Engine
	tracer       tracing.Tracer
	Dialect      Dialect
	migrations   []Migration
	migrationIds map[string]struct{}
	Logger       log.Logger
	Cfg          *setting.Cfg
	isLocked     atomic.Bool
	logMap       map[string]MigrationLog
	tableName    string
}

type MigrationLog struct {
	Id          int64
	MigrationID string `xorm:"migration_id"`
	SQL         string `xorm:"sql"`
	Success     bool
	Error       string
	Timestamp   time.Time
}

func NewMigrator(engine *xorm.Engine, cfg *setting.Cfg, tracer tracing.Tracer) *Migrator {
	return NewScopedMigrator(engine, cfg, tracer, "")
}

// NewScopedMigrator should only be used for the transition to a new storage engine
func NewScopedMigrator(engine *xorm.Engine, cfg *setting.Cfg, tracer tracing.Tracer, scope string) *Migrator {
	mg := &Migrator{
		Cfg:          cfg,
		DBEngine:     engine,
		tracer:       tracer,
		migrations:   make([]Migration, 0),
		migrationIds: make(map[string]struct{}),
		Dialect:      NewDialect(engine.DriverName()),
	}
	if scope == "" {
		mg.tableName = "migration_log"
		mg.Logger = log.New("migrator")
	} else {
		mg.tableName = scope + "_migration_log"
		mg.Logger = log.New(scope + " migrator")
	}
	return mg
}

// AddCreateMigration adds the initial migration log table -- this should likely be
// automatic and first, but enough tests exists that do not expect that we can keep it explicit
func (mg *Migrator) AddCreateMigration() {
	mg.AddMigration("create "+mg.tableName+" table", NewAddTableMigration(Table{
		Name: mg.tableName,
		Columns: []*Column{
			{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "migration_id", Type: DB_NVarchar, Length: 255},
			{Name: "sql", Type: DB_Text},
			{Name: "success", Type: DB_Bool},
			{Name: "error", Type: DB_Text},
			{Name: "timestamp", Type: DB_DateTime},
		},
	}))
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

func (mg *Migrator) GetMigrationLog(ctx context.Context) (map[string]MigrationLog, error) {
	logMap := make(map[string]MigrationLog)
	logItems := make([]MigrationLog, 0)

	sess := mg.DBEngine.Context(ctx)
	exists, err := sess.IsTableExist(mg.tableName)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "failed to check table existence", err)
	}
	if !exists {
		return logMap, nil
	}

	if err = sess.Table(mg.tableName).Find(&logItems); err != nil {
		return nil, err
	}

	for _, logItem := range logItems {
		if !logItem.Success {
			continue
		}
		logMap[logItem.MigrationID] = logItem
	}

	mg.logMap = logMap
	return logMap, nil
}

func (mg *Migrator) RemoveMigrationLogs(migrationsIDs ...string) {
	for _, id := range migrationsIDs {
		delete(mg.logMap, id)
	}
}

func (mg *Migrator) Start(isDatabaseLockingEnabled bool, lockAttemptTimeout int) (err error) {
	ctx, span := mg.tracer.Start(context.Background(), "Migrator.Start")
	defer span.End()

	if !isDatabaseLockingEnabled {
		return mg.run(ctx)
	}

	dbName, err := mg.Dialect.GetDBName(mg.DBEngine.DataSourceName())
	if err != nil {
		return err
	}
	key, err := database.GenerateAdvisoryLockId(dbName)
	if err != nil {
		return err
	}

	return mg.InTransaction(func(sess *xorm.Session) error {
		sess.Context(ctx)
		mg.Logger.Info("Locking database")
		lockCfg := LockCfg{
			Session: sess,
			Key:     key,
			Timeout: lockAttemptTimeout,
		}

		if err := casRestoreOnErr(&mg.isLocked, false, true, ErrMigratorIsLocked, mg.Dialect.Lock, lockCfg); err != nil {
			mg.Logger.Error("Failed to lock database", "error", err)
			return err
		}

		defer func() {
			mg.Logger.Info("Unlocking database")
			unlockErr := casRestoreOnErr(&mg.isLocked, true, false, ErrMigratorIsUnlocked, mg.Dialect.Unlock, lockCfg)
			if unlockErr != nil {
				mg.Logger.Error("Failed to unlock database", "error", unlockErr)
			}
		}()

		// migration will run inside a nested transaction
		return mg.run(ctx)
	})
}

func (mg *Migrator) run(ctx context.Context) (err error) {
	ctx, span := mg.tracer.Start(ctx, "Migrator.run")
	defer span.End()
	logger := mg.Logger.FromContext(ctx)
	logger.Info("Starting DB migrations")

	_, err = mg.GetMigrationLog(ctx)
	if err != nil {
		return err
	}

	migrationsPerformed := 0
	migrationsSkipped := 0
	start := time.Now()
	for _, m := range mg.migrations {
		m := m
		_, exists := mg.logMap[m.Id()]
		if exists {
			logger.Debug("Skipping migration: Already executed", "id", m.Id())
			migrationsSkipped++
			continue
		}

		sql := m.SQL(mg.Dialect)

		record := MigrationLog{
			MigrationID: m.Id(),
			SQL:         sql,
			Timestamp:   time.Now(),
		}

		err := mg.InTransaction(func(sess *xorm.Session) error {
			sess.Context(ctx)
			err := mg.exec(ctx, m, sess)
			if err != nil {
				logger.Error("Exec failed", "id", m.Id(), "error", err, "sql", sql)
				record.Error = err.Error()
				if !m.SkipMigrationLog() {
					if _, err := sess.Table(mg.tableName).Insert(&record); err != nil {
						return err
					}
				}
				return err
			}
			record.Success = true
			if !m.SkipMigrationLog() {
				_, err = sess.Table(mg.tableName).Insert(&record)
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

	logger.Info("DB migrations completed", "performed", migrationsPerformed, "skipped", migrationsSkipped, "duration", time.Since(start))

	// Make sure migrations are synced
	return mg.DBEngine.Sync2()
}

func (mg *Migrator) exec(parentCtx context.Context, m Migration, sess *xorm.Session) error {
	start := time.Now()

	ctx, span := mg.tracer.Start(parentCtx, "Migrator.exec")
	span.SetAttributes("migration_id", m.Id(), attribute.String("migration_id", m.Id()))
	defer span.End()

	sess.Context(ctx)

	logger := mg.Logger.New("id", m.Id()).FromContext(ctx)
	logger.Info("Executing migration")

	condition := m.GetCondition()
	if condition != nil {
		sql, args := condition.SQL(mg.Dialect)

		if sql != "" {
			logger.Debug("Executing migration condition SQL", "sql", sql, "args", args)
			results, err := sess.SQL(sql, args...).Query()
			if err != nil {
				logger.Error("Executing migration condition failed", "error", err)
				return err
			}

			if !condition.IsFulfilled(results) {
				logger.Warn("Skipping migration: Already executed, but not recorded in migration log")
				return nil
			}
		}
	}

	var err error
	if codeMigration, ok := m.(CodeMigration); ok {
		logger.Debug("Executing code migration")
		err = codeMigration.Exec(sess, mg)
	} else {
		sql := m.SQL(mg.Dialect)
		logger.Debug("Executing sql migration", "sql", sql)
		_, err = sess.Exec(sql)
	}

	if err != nil {
		logger.Error("Migration failed", "error", err)
		span.SetStatus(codes.Error, err.Error())
		span.RecordError(err)
		return err
	}

	logger.Info("Migration successfully executed", "duration", time.Since(start))

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
