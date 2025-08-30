package sqlstore

import (
	"context"
	"fmt"
	"reflect"
	"sync"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/util/xorm"
	"github.com/grafana/grafana/pkg/util/xorm/core"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util/retryer"
)

var sessionLogger = log.New("sqlstore.session")
var ErrMaximumRetriesReached = errutil.Internal("sqlstore.max-retries-reached")

// Global tracker for SQLite connections with active transactions
// This is needed because modernc.org/sqlite doesn't support nested transactions,
// and multiple sessions can share the same underlying connection
var (
	sqliteConnectionTxMutex sync.RWMutex
	sqliteConnectionsWithTx = make(map[string]*DBSession)
)

type DBSession struct {
	*xorm.Session
	transactionOpen bool
	events          []any
	connectionID    string // identifier for the underlying connection
}

type DBTransactionFunc func(sess *DBSession) error

func (sess *DBSession) publishAfterCommit(msg any) {
	sess.events = append(sess.events, msg)
}

func (sess *DBSession) PublishAfterCommit(msg any) {
	sess.events = append(sess.events, msg)
}

// Commit overrides the xorm Session Commit to cleanup SQLite transaction tracking
func (sess *DBSession) Commit() error {
	err := sess.Session.Commit()
	if err == nil {
		sess.transactionOpen = false
		// Clean up SQLite connection tracking
		if sess.connectionID != "" {
			sqliteConnectionTxMutex.Lock()
			delete(sqliteConnectionsWithTx, sess.connectionID)
			sqliteConnectionTxMutex.Unlock()
			fmt.Printf("  Cleaned up SQLite transaction tracking for connection %s\n", sess.connectionID)
		}
	}
	return err
}

// Rollback overrides the xorm Session Rollback to cleanup SQLite transaction tracking
func (sess *DBSession) Rollback() error {
	err := sess.Session.Rollback()
	if err == nil {
		sess.transactionOpen = false
		// Clean up SQLite connection tracking
		if sess.connectionID != "" {
			sqliteConnectionTxMutex.Lock()
			delete(sqliteConnectionsWithTx, sess.connectionID)
			sqliteConnectionTxMutex.Unlock()
			fmt.Printf("  Cleaned up SQLite transaction tracking for connection %s\n", sess.connectionID)
		}
	}
	return err
}

func startSessionOrUseExisting(ctx context.Context, engine *xorm.Engine, beginTran bool, tracer tracing.Tracer) (*DBSession, bool, trace.Span, error) {
	fmt.Println("startSessionOrUseExisting called with beginTran:", beginTran)
	value := ctx.Value(ContextSessionKey{})
	var sess *DBSession
	sess, ok := value.(*DBSession)

	// Check if we're using SQLite and if there's already a transaction on this connection
	isSQLite := engine.Dialect().DriverName() == "sqlite" || engine.Dialect().DriverName() == "sqlite3"

	if ok {
		ctxLogger := sessionLogger.FromContext(ctx)
		ctxLogger.Debug("reusing existing session", "transaction", sess.transactionOpen)
		fmt.Printf("  Found existing session: transactionOpen=%v, sess=%p\n", sess.transactionOpen, sess)
		sess.Session = sess.Context(ctx)

		// If we found an existing session and it has a transaction open,
		// reuse it regardless of the beginTran parameter
		if sess.transactionOpen {
			// This is a noop span to simplify later operations. purposefully not using existing context
			_, span := noop.NewTracerProvider().Tracer("integrationtests").Start(ctx, "sqlstore.startSessionOrUseExisting")
			return sess, false, span, nil
		}

		// If there's an existing session but no transaction, and we need a transaction,
		// we need to start one on the existing session to avoid nested transaction issues
		if beginTran {
			fmt.Printf("  Starting transaction on existing session\n")
			err := sess.Begin()
			if err != nil {
				return nil, false, nil, err
			}
			sess.transactionOpen = true

			// For SQLite, track this session globally
			if isSQLite {
				sqliteConnectionTxMutex.Lock()
				sqliteConnectionsWithTx[sess.connectionID] = sess
				sqliteConnectionTxMutex.Unlock()
			}

			// This is a noop span to simplify later operations. purposefully not using existing context
			_, span := noop.NewTracerProvider().Tracer("integrationtests").Start(ctx, "sqlstore.startSessionOrUseExisting")
			return sess, false, span, nil
		}

		// This is a noop span to simplify later operations. purposefully not using existing context
		_, span := noop.NewTracerProvider().Tracer("integrationtests").Start(ctx, "sqlstore.startSessionOrUseExisting")
		return sess, false, span, nil
	}

	fmt.Println("  No existing session found, creating new session")

	// For SQLite, check if there's already a transaction on any connection
	if isSQLite && beginTran {
		sqliteConnectionTxMutex.RLock()
		for connID, existingTxSess := range sqliteConnectionsWithTx {
			if existingTxSess != nil && existingTxSess.transactionOpen {
				fmt.Printf("  Found existing SQLite transaction on connection %s, reusing session %p\n", connID, existingTxSess)
				sqliteConnectionTxMutex.RUnlock()

				// Return the existing session with transaction
				_, span := noop.NewTracerProvider().Tracer("integrationtests").Start(ctx, "sqlstore.startSessionOrUseExisting")
				return existingTxSess, false, span, nil
			}
		}
		sqliteConnectionTxMutex.RUnlock()
	}

	tctx, span := tracer.Start(ctx, "open session")

	span.SetAttributes(attribute.Bool("transaction", beginTran))

	// Create a unique connection ID for tracking
	connectionID := fmt.Sprintf("conn-%p", engine)

	newSess := &DBSession{
		Session:         engine.NewSession(),
		transactionOpen: beginTran,
		connectionID:    connectionID,
	}
	fmt.Printf("  Created new session: beginTran=%v, sess=%p, connID=%s\n", beginTran, newSess, connectionID)

	if beginTran {
		err := newSess.Begin()
		fmt.Println("  beginTran called, error:", err)
		if err != nil {
			return nil, false, span, err
		}

		// For SQLite, track this session globally
		if isSQLite {
			sqliteConnectionTxMutex.Lock()
			sqliteConnectionsWithTx[connectionID] = newSess
			sqliteConnectionTxMutex.Unlock()
		}
	}
	newSess.Session = newSess.Context(tctx)

	return newSess, true, span, nil
}

// WithDbSession calls the callback with the session in the context (if exists).
// Otherwise it creates a new one that is closed upon completion.
// A session is stored in the context if sqlstore.InTransaction() has been previously called with the same context (and it's not committed/rolledback yet).
// In case of retryable errors, callback will be retried at most five times before giving up.
func (ss *SQLStore) WithDbSession(ctx context.Context, callback DBTransactionFunc) error {
	return ss.withDbSession(ctx, ss.engine, callback)
}

func (ss *SQLStore) retryOnLocks(ctx context.Context, callback DBTransactionFunc, sess *DBSession, retry int, dialect core.Dialect) func() (retryer.RetrySignal, error) {
	return func() (retryer.RetrySignal, error) {
		retry++

		err := callback(sess)

		ctxLogger := tsclogger.FromContext(ctx)

		if r, ok := dialect.(xorm.DialectWithRetryableErrors); ok && r.RetryOnError(err) {
			ctxLogger.Info("Database locked, sleeping then retrying", "error", err, "retry", retry, "code")
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

func (ss *SQLStore) withDbSession(ctx context.Context, engine *xorm.Engine, callback DBTransactionFunc) error {
	sess, isNew, span, err := startSessionOrUseExisting(ctx, engine, false, ss.tracer)
	defer span.End()

	if err != nil {
		return tracing.Errorf(span, "start session failed: %s", err)
	}

	if isNew {
		defer sess.Close()
	}
	retry := 0
	return retryer.Retry(ss.retryOnLocks(ctx, callback, sess, retry, engine.Dialect()), ss.dbCfg.QueryRetries, time.Millisecond*time.Duration(10), time.Second)
}

func (sess *DBSession) InsertId(bean any, dialect migrator.Dialect) error {
	table := sess.DB().Mapper.Obj2Table(getTypeName(bean))

	if err := dialect.PreInsertId(table, sess.Session); err != nil {
		return err
	}
	_, err := sess.InsertOne(bean)
	if err != nil {
		return err
	}
	if err := dialect.PostInsertId(table, sess.Session); err != nil {
		return err
	}

	return nil
}

func (sess *DBSession) WithReturningID(driverName string, query string, args []any) (int64, error) {
	var id int64
	if driverName == migrator.Postgres {
		query = fmt.Sprintf("%s RETURNING id", query)
		if _, err := sess.SQL(query, args...).Get(&id); err != nil {
			return id, err
		}
	} else {
		sqlOrArgs := append([]any{query}, args...)
		res, err := sess.Exec(sqlOrArgs...)
		if err != nil {
			return id, err
		}
		id, err = res.LastInsertId()
		if err != nil {
			return id, err
		}
	}
	return id, nil
}

func getTypeName(bean any) (res string) {
	t := reflect.TypeOf(bean)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	return t.Name()
}
