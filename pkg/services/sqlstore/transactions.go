package sqlstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/log"
	sqlite3 "github.com/mattn/go-sqlite3"
)

func (ss *SqlStore) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return ss.inTransactionWithRetry(ctx, fn, 0)
}

func (ss *SqlStore) inTransactionWithRetry(ctx context.Context, fn func(ctx context.Context) error, retry int) error {
	sess, err := startSession(ctx, ss.engine, true)
	if err != nil {
		return err
	}

	defer sess.Close()

	withValue := context.WithValue(ctx, ContextSessionName, sess)

	err = fn(withValue)

	// special handling of database locked errors for sqlite, then we can retry 3 times
	if sqlError, ok := err.(sqlite3.Error); ok && retry < 5 {
		if sqlError.Code == sqlite3.ErrLocked {
			sess.Rollback()
			time.Sleep(time.Millisecond * time.Duration(10))
			ss.log.Info("Database table locked, sleeping then retrying", "retry", retry)
			return ss.inTransactionWithRetry(ctx, fn, retry+1)
		}
	}

	if err != nil {
		sess.Rollback()
		return err
	}

	if err = sess.Commit(); err != nil {
		return err
	}

	if len(sess.events) > 0 {
		for _, e := range sess.events {
			if err = bus.Publish(e); err != nil {
				ss.log.Error("Failed to publish event after commit", err)
			}
		}
	}

	return nil
}

func inTransactionWithRetry(callback dbTransactionFunc, retry int) error {
	return inTransactionWithRetryCtx(context.Background(), callback, retry)
}

func inTransactionWithRetryCtx(ctx context.Context, callback dbTransactionFunc, retry int) error {
	sess, err := startSession(ctx, x, true)
	if err != nil {
		return err
	}

	defer sess.Close()

	err = callback(sess)

	// special handling of database locked errors for sqlite, then we can retry 3 times
	if sqlError, ok := err.(sqlite3.Error); ok && retry < 5 {
		if sqlError.Code == sqlite3.ErrLocked {
			sess.Rollback()
			time.Sleep(time.Millisecond * time.Duration(10))
			sqlog.Info("Database table locked, sleeping then retrying", "retry", retry)
			return inTransactionWithRetry(callback, retry+1)
		}
	}

	if err != nil {
		sess.Rollback()
		return err
	} else if err = sess.Commit(); err != nil {
		return err
	}

	if len(sess.events) > 0 {
		for _, e := range sess.events {
			if err = bus.Publish(e); err != nil {
				log.Error(3, "Failed to publish event after commit. error: %v", err)
			}
		}
	}

	return nil
}

func inTransaction(callback dbTransactionFunc) error {
	return inTransactionWithRetry(callback, 0)
}

func inTransactionCtx(ctx context.Context, callback dbTransactionFunc) error {
	return inTransactionWithRetryCtx(ctx, callback, 0)
}
