package migrator

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-migrate/migrate/v4/database"
	_ "github.com/lib/pq"
	"github.com/mattn/go-sqlite3"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/atomic"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrMigratorIsLocked   = fmt.Errorf("migrator is locked")
	ErrMigratorIsUnlocked = fmt.Errorf("migrator is unlocked")
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/sqlstore/migrator")

type Migrator struct {
	DBEngine     *xorm.Engine
	Dialect      Dialect
	migrations   []Migration
	migrationIds map[string]struct{}
	Logger       log.Logger
	Cfg          *setting.Cfg
	isLocked     atomic.Bool
	logMap       map[string]MigrationLog
	tableName    string

	metrics migratorMetrics
}

type MigrationLog struct {
	Id          int64
	MigrationID string `xorm:"migration_id"`
	SQL         string `xorm:"sql"`
	Success     bool
	Error       string
	Timestamp   time.Time
}

type migratorMetrics struct {
	migCount         *prometheus.CounterVec
	migDuration      *prometheus.HistogramVec
	totalMigDuration *prometheus.HistogramVec
}

func NewMigrator(engine *xorm.Engine, cfg *setting.Cfg) *Migrator {
	return NewScopedMigrator(engine, cfg, "")
}

// NewScopedMigrator should only be used for the transition to a new storage engine
func NewScopedMigrator(engine *xorm.Engine, cfg *setting.Cfg, scope string) *Migrator {
	mg := &Migrator{
		Cfg:          cfg,
		DBEngine:     engine,
		migrations:   make([]Migration, 0),
		migrationIds: make(map[string]struct{}),
		Dialect:      NewDialect(engine.DriverName()),
		metrics: migratorMetrics{
			migCount: prometheus.NewCounterVec(prometheus.CounterOpts{
				Namespace: "grafana_database",
				Subsystem: scope,
				Name:      "migrations_total",
				Help:      "Total number of SQL migrations",
			}, []string{"success"}),
			migDuration: metricutil.NewHistogramVec(prometheus.HistogramOpts{
				Namespace: "grafana_database",
				Subsystem: scope,
				Name:      "migration_duration_seconds",
				Help:      "Individual SQL migration duration in seconds",
			}, []string{"success"}),
			totalMigDuration: metricutil.NewHistogramVec(prometheus.HistogramOpts{
				Namespace: "grafana_database",
				Subsystem: scope,
				Name:      "all_migrations_duration_seconds",
				Help:      "Duration of the entire SQL migration process in seconds",
			}, []string{"success"}),
		},
	}
	if scope == "" {
		mg.tableName = "migration_log"
		mg.Logger = log.New("migrator")
	} else {
		mg.tableName = scope + "_migration_log"
		mg.Logger = log.New(scope + "-migrator")
	}
	return mg
}

// Collect implements Prometheus.Collector.
func (mg *Migrator) Collect(ch chan<- prometheus.Metric) {
	mg.metrics.migCount.Collect(ch)
	mg.metrics.migDuration.Collect(ch)
	mg.metrics.totalMigDuration.Collect(ch)
}

// Describe implements Prometheus.Collector.
func (mg *Migrator) Describe(ch chan<- *prometheus.Desc) {
	mg.metrics.migCount.Describe(ch)
	mg.metrics.migDuration.Describe(ch)
	mg.metrics.totalMigDuration.Describe(ch)
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

func (mg *Migrator) GetMigrationLog() (map[string]MigrationLog, error) {
	logMap := make(map[string]MigrationLog)
	logItems := make([]MigrationLog, 0)
	if err := mg.DBEngine.Table(mg.tableName).Find(&logItems); err != nil {
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

// soft-deprecated: use RunMigrations instead (will be fully deprecated later)
func (mg *Migrator) Start(isDatabaseLockingEnabled bool, lockAttemptTimeout int) (err error) {
	return mg.RunMigrations(context.Background(), isDatabaseLockingEnabled, lockAttemptTimeout)
}

func (mg *Migrator) RunMigrations(ctx context.Context, isDatabaseLockingEnabled bool, lockAttemptTimeout int) (err error) {
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

	logger := mg.Logger.FromContext(ctx)

	return mg.InTransaction(func(sess *xorm.Session) error {
		logger.Info("Locking database")
		lockCfg := LockCfg{
			Session: sess,
			Key:     key,
			Timeout: lockAttemptTimeout,
		}

		if err := casRestoreOnErr(&mg.isLocked, false, true, ErrMigratorIsLocked, mg.Dialect.Lock, lockCfg); err != nil {
			logger.Error("Failed to lock database", "error", err)
			return err
		}

		defer func() {
			logger.Info("Unlocking database")
			unlockErr := casRestoreOnErr(&mg.isLocked, true, false, ErrMigratorIsUnlocked, mg.Dialect.Unlock, lockCfg)
			if unlockErr != nil {
				logger.Error("Failed to unlock database", "error", unlockErr)
			}
		}()

		// migration will run inside a nested transaction
		return mg.run(ctx)
	})
}

func (mg *Migrator) run(ctx context.Context) (err error) {
	ctx, span := tracer.Start(ctx, "Migrator.run")
	defer span.End()

	logger := mg.Logger.FromContext(ctx)

	logger.Info("Starting DB migrations")

	migrationLogExists, err := mg.DBEngine.IsTableExist(mg.tableName)
	if err != nil {
		return fmt.Errorf("failed to check table existence: %w", err)
	}

	if !migrationLogExists {
		// Check if dialect can initialize database from a snapshot.
		err := mg.Dialect.CreateDatabaseFromSnapshot(ctx, mg.DBEngine, mg.tableName)
		if err != nil {
			return fmt.Errorf("failed to create database from snapshot: %w", err)
		}

		migrationLogExists, err = mg.DBEngine.IsTableExist(mg.tableName)
		if err != nil {
			return fmt.Errorf("failed to check table existence after applying snapshot: %w", err)
		}
	}

	if migrationLogExists {
		_, err = mg.GetMigrationLog()
		if err != nil {
			return err
		}
	}

	successLabel := prometheus.Labels{"success": "true"}

	migrationsPerformed := 0
	migrationsSkipped := 0
	start := time.Now()
	for _, m := range mg.migrations {
		_, exists := mg.logMap[m.Id()]
		if exists {
			logger.Debug("Skipping migration: Already executed", "id", m.Id())
			span.AddEvent("Skipping migration: Already executed",
				trace.WithAttributes(attribute.String("migration_id", m.Id())),
			)
			migrationsSkipped++
			continue
		}

		migStart := time.Now()

		if err := mg.doMigration(ctx, m); err != nil {
			failLabel := prometheus.Labels{"success": "false"}
			metricutil.ObserveWithExemplar(ctx, mg.metrics.migDuration.With(failLabel), time.Since(migStart).Seconds())
			mg.metrics.migCount.With(failLabel).Inc()
			return err
		}

		metricutil.ObserveWithExemplar(ctx, mg.metrics.migDuration.With(successLabel), time.Since(migStart).Seconds())
		mg.metrics.migCount.With(successLabel).Inc()

		migrationsPerformed++
	}

	metricutil.ObserveWithExemplar(ctx, mg.metrics.totalMigDuration.With(successLabel), time.Since(start).Seconds())

	logger.Info("migrations completed", "performed", migrationsPerformed, "skipped", migrationsSkipped, "duration", time.Since(start))

	// Make sure migrations are synced
	return mg.DBEngine.Sync2()
}

func (mg *Migrator) doMigration(ctx context.Context, m Migration) error {
	ctx, span := tracer.Start(ctx, "Migrator.doMigration", trace.WithAttributes(
		attribute.String("migration_id", m.Id()),
	))
	defer span.End()

	logger := mg.Logger.FromContext(ctx)

	sql := m.SQL(mg.Dialect)

	record := MigrationLog{
		MigrationID: m.Id(),
		SQL:         sql,
		Timestamp:   time.Now(),
	}

	err := mg.InTransaction(func(sess *xorm.Session) error {
		// propagate context
		sess = sess.Context(ctx)

		err := mg.exec(ctx, m, sess)
		// if we get an sqlite busy/locked error, sleep 100ms and try again
		cnt := 0
		for cnt < 3 && (errors.Is(err, sqlite3.ErrLocked) || errors.Is(err, sqlite3.ErrBusy)) {
			cnt++
			logger.Debug("Database locked, sleeping then retrying", "error", err, "sql", sql)
			span.AddEvent("Database locked, sleeping then retrying",
				trace.WithAttributes(attribute.String("error", err.Error())),
				trace.WithAttributes(attribute.String("sql", sql)),
			)
			time.Sleep(100 * time.Millisecond)
			err = mg.exec(ctx, m, sess)
		}

		if err != nil {
			logger.Error("Exec failed", "error", err, "sql", sql)
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
		return err
	})
	if err != nil {
		return tracing.Errorf(span, "migration failed (id = %s): %w", m.Id(), err)
	}

	span.SetStatus(codes.Ok, "")

	return nil
}

func (mg *Migrator) exec(ctx context.Context, m Migration, sess *xorm.Session) error {
	logger := mg.Logger.FromContext(ctx)

	start := time.Now()
	logger.Info("Executing migration", "id", m.Id())

	condition := m.GetCondition()
	if condition != nil {
		sql, args := condition.SQL(mg.Dialect)

		if sql != "" {
			logger.Debug("Executing migration condition SQL", "id", m.Id(), "sql", sql, "args", args)
			results, err := sess.SQL(sql, args...).Query()
			if err != nil {
				logger.Error("Executing migration condition failed", "id", m.Id(), "error", err)
				return err
			}

			if !condition.IsFulfilled(results) {
				logger.Warn("Skipping migration: Already executed, but not recorded in migration log", "id", m.Id())
				return nil
			}
		}
	}

	var err error
	if codeMigration, ok := m.(CodeMigration); ok {
		logger.Debug("Executing code migration", "id", m.Id())
		err = codeMigration.Exec(sess, mg)
	} else {
		sql := m.SQL(mg.Dialect)
		if strings.TrimSpace(sql) == "" {
			logger.Debug("Skipping empty sql migration", "id", m.Id())
		} else {
			logger.Debug("Executing sql migration", "id", m.Id(), "sql", sql)
			_, err = sess.Exec(sql)
		}
	}

	if err != nil {
		logger.Error("Executing migration failed", "id", m.Id(), "error", err, "duration", time.Since(start))
		return err
	}

	logger.Info("Migration successfully executed", "id", m.Id(), "duration", time.Since(start))

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
