package sqlstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/mattn/go-sqlite3"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
)

var tsclogger = log.New("sqlstore.transactions")

// WithTransactionalDbSession calls the callback with a session within a transaction.
func (ss *SQLStore) WithTransactionalDbSession(ctx context.Context, callback DBTransactionFunc) error {
	return inTransactionWithRetryCtx(ctx, ss.engine, ss.bus, callback, 0)
}

func (ss *SQLStore) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return ss.inTransactionWithRetry(ctx, fn, 0)
}

func (ss *SQLStore) inTransactionWithRetry(ctx context.Context, fn func(ctx context.Context) error, retry int) error {
	return inTransactionWithRetryCtx(ctx, ss.engine, ss.bus, func(sess *DBSession) error {
		withValue := context.WithValue(ctx, ContextSessionKey{}, sess)
		return fn(withValue)
	}, retry)
}

func inTransactionWithRetryCtx(ctx context.Context, engine *xorm.Engine, bus bus.Bus, callback DBTransactionFunc, retry int) error {
	sess, isNew, err := startSessionOrUseExisting(ctx, engine, true)
	if err != nil {
		return err
	}

	if !sess.transactionOpen && !isNew {
		// this should not happen because the only place that creates reusable session begins a new transaction.
		return fmt.Errorf("cannot reuse existing session that did not start transaction")
	}

	if isNew { // if this call initiated the session, it should be responsible for closing it.
		defer sess.Close()
	}

	err = callback(sess)

	if !isNew {
		tsclogger.Debug("skip committing the transaction because it belongs to a session created in the outer scope")
		// Do not commit the transaction if the session was reused.
		return err
	}

	// special handling of database locked errors for sqlite, then we can retry 5 times
	var sqlError sqlite3.Error
	if errors.As(err, &sqlError) && retry < 5 && (sqlError.Code == sqlite3.ErrLocked || sqlError.Code == sqlite3.ErrBusy) {
		if rollErr := sess.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
		}

		time.Sleep(time.Millisecond * time.Duration(10))
		sqlog.Info("Database locked, sleeping then retrying", "error", err, "retry", retry)
		return inTransactionWithRetryCtx(ctx, engine, bus, callback, retry+1)
	}

	if err != nil {
		if rollErr := sess.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
		}
		return err
	}
	if err := sess.Commit(); err != nil {
		return err
	}

	if len(sess.events) > 0 {
		for _, e := range sess.events {
			if err = bus.Publish(ctx, e); err != nil {
				tsclogger.Error("Failed to publish event after commit.", "error", err)
			}
		}
	}

	return nil
}

func (ss *SQLStore) SQLxInTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	if ss.Cfg.IsFeatureToggleEnabled("newDBLibrary") {
		ss.sqlxInTransactionWithRetry(ctx, fn, 0)
	}
	return ss.inTransactionWithRetry(ctx, fn, 0)
}

type SQLxDBTransaction struct {
	*session.SessionTx
	transactionOpen bool
	events          []interface{}
}

func (ss *SQLStore) sqlxInTransactionWithRetry(ctx context.Context, fn func(ctx context.Context) error, retry int) error {
	return sqlxInTransactionWithRetryCtx(ctx, ss.GetSqlxSession(), ss.bus, func(tx *SQLxDBTransaction) error {
		withValue := context.WithValue(ctx, ContextSQLxTransactionKey{}, tx)
		return fn(withValue)
	}, retry)
}

func sqlxInTransactionWithRetryCtx(ctx context.Context, sess *session.SessionDB, bus bus.Bus, callback SQLxDBTransactionFunc, retry int) error {
	trans, isNew, err := sqlxStartTransactionOrUseExisting(ctx, sess)
	if err != nil {
		return err
	}

	if !trans.transactionOpen && !isNew {
		// this should not happen because the only place that creates reusable session begins a new transaction.
		return fmt.Errorf("cannot reuse existing session that did not start transaction")
	}

	if isNew { // if this call initiated the session, it should be responsible for closing it.
		defer trans.Commit()
	}

	err = callback(trans)

	if !isNew {
		tsclogger.Debug("skip committing the transaction because it belongs to a session created in the outer scope")
		// Do not commit the transaction if the session was reused.
		return err
	}

	// special handling of database locked errors for sqlite, then we can retry 5 times
	var sqlError sqlite3.Error
	if errors.As(err, &sqlError) && retry < 5 && (sqlError.Code == sqlite3.ErrLocked || sqlError.Code == sqlite3.ErrBusy) {
		if rollErr := trans.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
		}

		time.Sleep(time.Millisecond * time.Duration(10))
		sqlog.Info("Database locked, sleeping then retrying", "error", err, "retry", retry)
		return sqlxInTransactionWithRetryCtx(ctx, sess, bus, callback, retry+1)
	}

	if err != nil {
		if rollErr := trans.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
		}
		return err
	}

	err = trans.Commit()
	if err != nil {
		return err
	}

	if len(trans.events) > 0 {
		for _, e := range trans.events {
			if err = bus.Publish(ctx, e); err != nil {
				tsclogger.Error("Failed to publish event after commit.", "error", err)
			}
		}
	}

	return nil
}

func sqlxStartTransactionOrUseExisting(ctx context.Context, sess *session.SessionDB) (*SQLxDBTransaction, bool, error) {
	value := ctx.Value(ContextSQLxTransactionKey{})
	var trans *SQLxDBTransaction
	trans, ok := value.(*SQLxDBTransaction)

	if ok {
		sessionLogger.Debug("reusing existing session", "transaction", trans.transactionOpen)
		return trans, false, nil
	}

	tx, err := sess.Beginx()
	if err != nil {
		return nil, false, err
	}
	newTrans := &SQLxDBTransaction{SessionTx: tx, transactionOpen: true}
	return newTrans, true, nil
}
