package sqlstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
)

var tsclogger = log.New("sqlstore.transactions")

// WithTransactionalDbSession calls the callback with a session within a transaction.
func (ss *SQLStore) WithTransactionalDbSession(ctx context.Context, callback DBTransactionFunc) error {
	return ss.inTransactionWithRetryCtx(ctx, ss.engine, ss.bus, callback, 0)
}

// InTransaction starts a transaction and calls the fn
// It stores the session in the context
func (ss *SQLStore) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return ss.inTransactionWithRetry(ctx, fn, 0)
}

func (ss *SQLStore) inTransactionWithRetry(ctx context.Context, fn func(ctx context.Context) error, retry int) error {
	return ss.inTransactionWithRetryCtx(ctx, ss.engine, ss.bus, func(sess *DBSession) error {
		withValue := context.WithValue(ctx, ContextSessionKey{}, sess)
		return fn(withValue)
	}, retry)
}

func (ss *SQLStore) inTransactionWithRetryCtx(ctx context.Context, engine *xorm.Engine, bus bus.Bus, callback DBTransactionFunc, retry int) error {
	sess, isNew, span, err := startSessionOrUseExisting(ctx, engine, true, ss.tracer)
	if err != nil {
		return err
	}

	if !sess.transactionOpen && !isNew {
		// this should not happen because the only place that creates reusable session begins a new transaction.
		return fmt.Errorf("cannot reuse existing session that did not start transaction")
	}

	if isNew { // if this call initiated the session, it should be responsible for closing it.
		defer func() {
			if span != nil {
				span.End()
			}
			sess.Close()
		}()
	}

	err = callback(sess)

	ctxLogger := tsclogger.FromContext(ctx)

	if !isNew {
		ctxLogger.Debug("skip committing the transaction because it belongs to a session created in the outer scope")
		// Do not commit the transaction if the session was reused.
		return err
	}

	// special handling of database locked errors for sqlite, then we can retry 5 times
	if r, ok := engine.Dialect().(xorm.DialectWithRetryableErrors); ok {
		if retry < ss.dbCfg.TransactionRetries && r.RetryOnError(err) {
			if rollErr := sess.Rollback(); rollErr != nil {
				return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
			}

			time.Sleep(time.Millisecond * time.Duration(10))
			ctxLogger.Info("Database locked, sleeping then retrying", "error", err, "retry", retry)
			return ss.inTransactionWithRetryCtx(ctx, engine, bus, callback, retry+1)
		}
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

	for _, e := range sess.events {
		if err = bus.Publish(ctx, e); err != nil {
			ctxLogger.Error("Failed to publish event after commit.", "error", err)
		}
	}

	return nil
}
