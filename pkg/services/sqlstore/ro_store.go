package sqlstore

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"xorm.io/core"
	"xorm.io/xorm"

	"github.com/dlmiddlecote/sqlstats"
	"github.com/go-sql-driver/mysql"
	"github.com/mattn/go-sqlite3"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/retryer"
)

type ReplStore struct {
	cfg         *setting.Cfg
	features    featuremgmt.FeatureToggles
	sqlxsession *session.SessionDB

	bus                          bus.Bus
	dbCfg                        *DatabaseConfig
	engine                       *xorm.Engine
	log                          log.Logger
	dialect                      migrator.Dialect
	tracer                       tracing.Tracer
	recursiveQueriesAreSupported *bool
	recursiveQueriesMu           sync.Mutex
}

func ProvideReadOnlyService(cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	bus bus.Bus, tracer tracing.Tracer) (*ReplStore, error) {
	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""
	s, err := newReadOnlySQLStore(cfg, features, bus, tracer)
	if err != nil {
		return nil, err
	}
	s.features = features
	s.tracer = tracer

	// initialize and register metrics wrapper around the *sql.DB
	db := s.engine.DB().DB

	// register the go_sql_stats_connections_* metrics
	if err := prometheus.Register(sqlstats.NewStatsCollector("grafana", db)); err != nil {
		s.log.Warn("Failed to register sqlstore stats collector", "error", err)
	}
	// TODO: deprecate/remove these metrics
	if err := prometheus.Register(newSQLStoreMetrics(db)); err != nil {
		s.log.Warn("Failed to register sqlstore metrics", "error", err)
	}

	return s, nil
}

// newReadOnlySQLStore creates a new *SQLStore intended for use with a
// fully-populated read replica of the main Grafana Database. It provides no
// write capabilities and does not run migrations, but other tracing and logging
// features are enabled.
func newReadOnlySQLStore(cfg *setting.Cfg, features featuremgmt.FeatureToggles, bus bus.Bus, tracer tracing.Tracer) (*ReplStore, error) {
	s := &ReplStore{
		cfg:    cfg,
		log:    log.New("sqlstore"),
		bus:    bus,
		tracer: tracer,
	}

	s.features = features
	s.tracer = tracer

	s.initReadOnlyEngine(s.engine)
	s.dialect = migrator.NewDialect(s.engine.DriverName())
	return s, nil
}

// initReadOnlyEngine initializes ss.engine for read-only operations. The database must be a fully-populated read replica.
func (ss *ReplStore) initReadOnlyEngine(engine *xorm.Engine) error {
	if ss.engine != nil {
		ss.log.Debug("Already connected to database")
		return nil
	}

	dbCfg, err := NewRODatabaseConfig(ss.cfg, ss.features)
	if err != nil {
		return err
	}
	ss.dbCfg = dbCfg

	if ss.cfg.DatabaseInstrumentQueries {
		ss.dbCfg.Type = WrapDatabaseDriverWithHooks(ss.dbCfg.Type, ss.tracer)
	}

	if engine == nil {
		var err error
		engine, err = xorm.NewEngine(ss.dbCfg.Type, ss.dbCfg.ConnectionString)
		if err != nil {
			ss.log.Error("failed to connect to database", "error", err)
			return err
		}
		// Only for MySQL or MariaDB, verify we can connect with the current connection string's system var for transaction isolation.
		// If not, create a new engine with a compatible connection string.
		if ss.dbCfg.Type == migrator.MySQL {
			engine, err = ss.ensureTransactionIsolationCompatibility(engine, ss.dbCfg.ConnectionString)
			if err != nil {
				return err
			}
		}
	}

	engine.SetMaxOpenConns(ss.dbCfg.MaxOpenConn)
	engine.SetMaxIdleConns(ss.dbCfg.MaxIdleConn)
	engine.SetConnMaxLifetime(time.Second * time.Duration(ss.dbCfg.ConnMaxLifetime))

	// configure sql logging
	debugSQL := ss.cfg.Raw.Section("database").Key("log_queries").MustBool(false)
	if !debugSQL {
		engine.SetLogger(&xorm.DiscardLogger{})
	} else {
		// add stack to database calls to be able to see what repository initiated queries. Top 7 items from the stack as they are likely in the xorm library.
		engine.SetLogger(NewXormLogger(log.LvlInfo, log.WithSuffix(log.New("sqlstore.xorm"), log.CallerContextKey, log.StackCaller(log.DefaultCallerDepth))))
		engine.ShowSQL(true)
		engine.ShowExecTime(true)
	}

	ss.engine = engine
	return nil
}

// NewRODatabaseConfig creates a new read-only database configuration.
// None of this is what I'd do for an actual implementation; the goal is to
// modify as little existing code as possible for now.
func NewRODatabaseConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*DatabaseConfig, error) {
	if cfg == nil {
		return nil, errors.New("cfg cannot be nil")
	}

	dbCfg := &DatabaseConfig{}
	if err := dbCfg.readConfigSection(cfg, "database_replica"); err != nil {
		return nil, err
	}

	if err := dbCfg.buildConnectionString(cfg, features); err != nil {
		return nil, err
	}

	return dbCfg, nil
}

// The transaction_isolation system variable isn't compatible with MySQL < 5.7.20 or MariaDB. If we get an error saying this
// system variable is unknown, then replace it with it's older version tx_isolation which is compatible with MySQL < 5.7.20 and MariaDB.
func (ss *ReplStore) ensureTransactionIsolationCompatibility(engine *xorm.Engine, connectionString string) (*xorm.Engine, error) {
	var result string
	_, err := engine.SQL("SELECT 1").Get(&result)

	var mysqlError *mysql.MySQLError
	if errors.As(err, &mysqlError) {
		// if there was an error due to transaction isolation
		if strings.Contains(mysqlError.Message, "Unknown system variable 'transaction_isolation'") {
			ss.log.Debug("transaction_isolation system var is unknown, overriding in connection string with tx_isolation instead")
			// replace with compatible system var for transaction isolation
			connectionString = strings.Replace(connectionString, "&transaction_isolation", "&tx_isolation", -1)
			// recreate the xorm engine with new connection string that is compatible
			engine, err = xorm.NewEngine(ss.dbCfg.Type, connectionString)
			if err != nil {
				return nil, err
			}
		}
	} else if err != nil {
		return nil, err
	}

	return engine, nil
}

// WithDbSession calls the callback with the session in the context (if exists).
// Otherwise it creates a new one that is closed upon completion.
// A session is stored in the context if sqlstore.InTransaction() has been previously called with the same context (and it's not committed/rolledback yet).
// In case of sqlite3.ErrLocked or sqlite3.ErrBusy failure it will be retried at most five times before giving up.
func (ss *ReplStore) WithDbSession(ctx context.Context, callback DBTransactionFunc) error {
	return ss.withDbSession(ctx, ss.engine, callback)
}

// WithNewDbSession calls the callback with a new session that is closed upon completion.
// In case of sqlite3.ErrLocked or sqlite3.ErrBusy failure it will be retried at most five times before giving up.
func (ss *ReplStore) WithNewDbSession(ctx context.Context, callback DBTransactionFunc) error {
	sess := &DBSession{Session: ss.engine.NewSession(), transactionOpen: false}
	defer sess.Close()
	retry := 0
	return retryer.Retry(ss.retryOnLocks(ctx, callback, sess, retry), ss.dbCfg.QueryRetries, time.Millisecond*time.Duration(10), time.Second)
}

func (ss *ReplStore) withDbSession(ctx context.Context, engine *xorm.Engine, callback DBTransactionFunc) error {
	sess, isNew, span, err := startSessionOrUseExisting(ctx, engine, false, ss.tracer)
	if err != nil {
		return err
	}
	if isNew {
		defer func() {
			if span != nil {
				span.End()
			}
			sess.Close()
		}()
	}
	retry := 0
	return retryer.Retry(ss.retryOnLocks(ctx, callback, sess, retry), ss.dbCfg.QueryRetries, time.Millisecond*time.Duration(10), time.Second)
}

func (ss *ReplStore) retryOnLocks(ctx context.Context, callback DBTransactionFunc, sess *DBSession, retry int) func() (retryer.RetrySignal, error) {
	return func() (retryer.RetrySignal, error) {
		retry++

		err := callback(sess)

		ctxLogger := tsclogger.FromContext(ctx)

		var sqlError sqlite3.Error
		if errors.As(err, &sqlError) && (sqlError.Code == sqlite3.ErrLocked || sqlError.Code == sqlite3.ErrBusy) {
			ctxLogger.Info("Database locked, sleeping then retrying", "error", err, "retry", retry, "code", sqlError.Code)
			// retryer immediately returns the error (if there is one) without checking the response
			// therefore we only have to send it if we have reached the maximum retries
			if retry >= ss.dbCfg.QueryRetries {
				return retryer.FuncError, ErrMaximumRetriesReached.Errorf("retry %d: %w", retry, err)
			}
			return retryer.FuncFailure, nil
		}

		if err != nil {
			return retryer.FuncError, err
		}

		return retryer.FuncComplete, nil
	}
}

// Quote quotes the value in the used SQL dialect
func (ss *ReplStore) Quote(value string) string {
	return ss.engine.Quote(value)
}

// GetDialect return the dialect
func (ss *ReplStore) GetDialect() migrator.Dialect {
	return ss.dialect
}

func (ss *ReplStore) GetDBType() core.DbType {
	return ss.engine.Dialect().DBType()
}

func (ss *ReplStore) GetEngine() *xorm.Engine {
	return ss.engine
}

func (ss *ReplStore) Bus() bus.Bus {
	return ss.bus
}
