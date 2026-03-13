package migrator

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/golang-migrate/migrate/v4/database"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/atomic"

	"github.com/grafana/dskit/backoff"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/sqlite"
)

var (
	ErrMigratorIsLocked   = fmt.Errorf("migrator is locked")
	ErrMigratorIsUnlocked = fmt.Errorf("migrator is unlocked")
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/sqlutil/migrator")

type Migrator struct {
	handle       Handle
	Dialect      Dialect
	migrations   []Migration
	migrationIds map[string]struct{}
	Logger       log.Logger
	isLocked     atomic.Bool
	logMap       map[string]MigrationLog
	tableName    string

	metrics migratorMetrics
}

type MigrationLog struct {
	ID          int64
	MigrationID string
	SQL         string
	Success     bool
	Error       string
	Timestamp   time.Time
}

type migratorMetrics struct {
	migCount         *prometheus.CounterVec
	migDuration      *prometheus.HistogramVec
	totalMigDuration *prometheus.HistogramVec
}

func NewMigrator(handle Handle) *Migrator {
	return NewScopedMigrator(handle, "")
}

func NewScopedMigrator(handle Handle, scope string) *Migrator {
	var dialect Dialect
	if handle != nil {
		dialect = NewDialect(handle.DriverName())
	}
	return newMigrator(handle, scope, dialect)
}

func newMigrator(handle Handle, scope string, dialect Dialect) *Migrator {
	mg := &Migrator{
		handle:       handle,
		migrations:   make([]Migration, 0),
		migrationIds: make(map[string]struct{}),
		Dialect:      dialect,
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
		mg.Logger = log.New("storage-migrator")
	} else {
		mg.tableName = scope + "_migration_log"
		mg.Logger = log.New(scope + "-storage-migrator")
	}
	return mg
}

func (mg *Migrator) SqlDB() *sql.DB {
	if mg.handle == nil {
		return nil
	}
	return mg.handle.SqlDB()
}

func (mg *Migrator) Collect(ch chan<- prometheus.Metric) {
	mg.metrics.migCount.Collect(ch)
	mg.metrics.migDuration.Collect(ch)
	mg.metrics.totalMigDuration.Collect(ch)
}

func (mg *Migrator) Describe(ch chan<- *prometheus.Desc) {
	mg.metrics.migCount.Describe(ch)
	mg.metrics.migDuration.Describe(ch)
	mg.metrics.totalMigDuration.Describe(ch)
}

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
	rows, err := mg.SqlDB().QueryContext(ctx, fmt.Sprintf(
		"SELECT id, migration_id, sql, success, error, timestamp FROM %s",
		mg.Dialect.Quote(mg.tableName),
	))
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	logMap := make(map[string]MigrationLog)
	for rows.Next() {
		var item MigrationLog
		if err := rows.Scan(&item.ID, &item.MigrationID, &item.SQL, &item.Success, &item.Error, &item.Timestamp); err != nil {
			return nil, err
		}
		if item.Success {
			logMap[item.MigrationID] = item
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	mg.logMap = logMap
	return logMap, nil
}

func (mg *Migrator) RemoveMigrationLogs(migrationsIDs ...string) {
	for _, id := range migrationsIDs {
		delete(mg.logMap, id)
	}
}

func (mg *Migrator) RunMigrations(ctx context.Context, isDatabaseLockingEnabled bool, lockAttemptTimeout int) error {
	if !isDatabaseLockingEnabled || mg.Dialect.DriverName() == SQLite {
		return mg.run(ctx)
	}

	dbName, err := mg.Dialect.GetDBName(ctx, mg.SqlDB())
	if err != nil {
		return err
	}
	key, err := database.GenerateAdvisoryLockId(dbName)
	if err != nil {
		return err
	}

	logger := mg.Logger.FromContext(ctx)
	conn, err := mg.SqlDB().Conn(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = conn.Close() }()

	logger.Info("Locking database")
	if err := casRestoreOnErr(&mg.isLocked, false, true, ErrMigratorIsLocked, func() error {
		return mg.Dialect.Lock(ctx, conn, key, lockAttemptTimeout)
	}); err != nil {
		logger.Error("Failed to lock database", "error", err)
		return err
	}
	defer func() {
		logger.Info("Unlocking database")
		unlockErr := casRestoreOnErr(&mg.isLocked, true, false, ErrMigratorIsUnlocked, func() error {
			return mg.Dialect.Unlock(ctx, conn, key)
		})
		if unlockErr != nil {
			logger.Error("Failed to unlock database", "error", unlockErr)
		}
	}()

	return mg.run(ctx)
}

func (mg *Migrator) run(ctx context.Context) (err error) {
	ctx, span := tracer.Start(ctx, "Migrator.run")
	defer span.End()

	logger := mg.Logger.FromContext(ctx)
	logger.Info("Starting DB migrations")

	migrationLogExists, err := mg.tableExists(ctx, mg.tableName)
	if err != nil {
		return fmt.Errorf("failed to check table existence: %w", err)
	}
	if migrationLogExists {
		if _, err := mg.GetMigrationLog(ctx); err != nil {
			return err
		}
	} else {
		mg.logMap = make(map[string]MigrationLog)
	}

	successLabel := prometheus.Labels{"success": "true"}
	migrationsPerformed := 0
	migrationsSkipped := 0
	start := time.Now()
	for _, m := range mg.migrations {
		if _, exists := mg.logMap[m.Id()]; exists {
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
	return nil
}

func (mg *Migrator) doMigration(ctx context.Context, m Migration) error {
	ctx, span := tracer.Start(ctx, "Migrator.doMigration", trace.WithAttributes(
		attribute.String("migration_id", m.Id()),
	))
	defer span.End()

	logger := mg.Logger.FromContext(ctx)
	sqlText := m.SQL(mg.Dialect)
	record := MigrationLog{
		MigrationID: m.Id(),
		SQL:         sqlText,
		Timestamp:   time.Now(),
	}

	err := mg.InTransaction(ctx, func(ctx context.Context, tx Tx) error {
		err := mg.exec(ctx, m, tx)
		if err != nil {
			logger.Error("Exec failed", "error", err, "sql", sqlText)
			record.Error = err.Error()
			if !m.SkipMigrationLog() {
				if err := mg.insertMigrationLog(ctx, tx, record); err != nil {
					return err
				}
			}
			return err
		}

		record.Success = true
		if !m.SkipMigrationLog() {
			return mg.insertMigrationLog(ctx, tx, record)
		}
		return nil
	})
	if err != nil {
		return tracing.Errorf(span, "migration failed (id = %s): %w", m.Id(), err)
	}

	span.SetStatus(codes.Ok, "")
	return nil
}

func (mg *Migrator) exec(ctx context.Context, m Migration, tx Tx) error {
	logger := mg.Logger.FromContext(ctx)
	start := time.Now()
	logger.Info("Executing migration", "id", m.Id())

	condition := m.GetCondition()
	if condition != nil {
		sqlText, args := condition.SQL(mg.Dialect)
		if sqlText != "" {
			logger.Debug("Executing migration condition SQL", "id", m.Id(), "sql", sqlText, "args", args)
			results, err := queryMaps(ctx, tx, sqlText, args...)
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
		err = codeMigration.Exec(ctx, tx, mg)
	} else {
		sqlText := m.SQL(mg.Dialect)
		if sqlText != "" {
			logger.Debug("Executing sql migration", "id", m.Id(), "sql", sqlText)
			_, err = tx.ExecContext(ctx, sqlText)
		}
	}
	if err != nil {
		logger.Error("Executing migration failed", "id", m.Id(), "error", err, "duration", time.Since(start))
		return err
	}

	logger.Info("Migration successfully executed", "id", m.Id(), "duration", time.Since(start))
	return nil
}

func (mg *Migrator) InTransaction(ctx context.Context, callback func(context.Context, Tx) error) error {
	b := backoff.New(context.Background(), backoff.Config{
		MinBackoff: 100 * time.Millisecond,
		MaxBackoff: time.Second,
		MaxRetries: 10,
	})

	var lastErr error
	for b.Ongoing() {
		lastErr = mg.inTransaction(ctx, callback)
		if !sqlite.IsBusyOrLocked(lastErr) {
			break
		}
		mg.Logger.Info("Database locked on migration, retrying transaction", "error", lastErr)
		b.Wait()
	}
	return errors.Join(lastErr, b.Err())
}

func (mg *Migrator) inTransaction(ctx context.Context, callback func(context.Context, Tx) error) error {
	tx, err := mg.SqlDB().BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	if err := callback(ctx, tx); err != nil {
		if rollbackErr := tx.Rollback(); rollbackErr != nil {
			return fmt.Errorf("failed to roll back transaction due to error: %s: %w", rollbackErr, err)
		}
		return err
	}

	return tx.Commit()
}

func (mg *Migrator) insertMigrationLog(ctx context.Context, tx Queryer, record MigrationLog) error {
	query := fmt.Sprintf(
		"INSERT INTO %s (%s, %s, %s, %s, %s) VALUES (?, ?, ?, ?, ?)",
		mg.Dialect.Quote(mg.tableName),
		mg.Dialect.Quote("migration_id"),
		mg.Dialect.Quote("sql"),
		mg.Dialect.Quote("success"),
		mg.Dialect.Quote("error"),
		mg.Dialect.Quote("timestamp"),
	)
	_, err := tx.ExecContext(ctx, query, record.MigrationID, record.SQL, record.Success, record.Error, record.Timestamp)
	return err
}

func (mg *Migrator) tableExists(ctx context.Context, tableName string) (bool, error) {
	sqlText, args := mg.Dialect.TableCheckSQL(tableName)
	results, err := queryMaps(ctx, mg.SqlDB(), sqlText, args...)
	if err != nil {
		return false, err
	}
	return len(results) > 0, nil
}

func queryMaps(ctx context.Context, queryer Queryer, sqlText string, args ...any) ([]map[string][]byte, error) {
	rows, err := queryer.QueryContext(ctx, sqlText, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	raw := make([]sql.RawBytes, len(cols))
	dest := make([]any, len(cols))
	for i := range raw {
		dest[i] = &raw[i]
	}

	results := make([]map[string][]byte, 0)
	for rows.Next() {
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		row := make(map[string][]byte, len(cols))
		for i, col := range cols {
			if raw[i] != nil {
				row[col] = append([]byte(nil), raw[i]...)
			}
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

func casRestoreOnErr(lock *atomic.Bool, o, n bool, casErr error, f func() error) error {
	if !lock.CompareAndSwap(o, n) {
		return casErr
	}
	if err := f(); err != nil {
		lock.Store(o)
		return err
	}
	return nil
}
