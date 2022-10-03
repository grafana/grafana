package sqlxsession

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/jmoiron/sqlx"
	"github.com/mattn/go-sqlite3"

	"github.com/grafana/grafana/pkg/infra/log"
)

type SQLxDBTransactionFunc func(tx *SessionTx) error
type ContextSQLxTransactionKey struct{}

type Session interface {
	Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error)
}

type SessionDB struct {
	sqlxdb *sqlx.DB
	bus    bus.Bus
	logger log.Logger
}

func GetSession(sqlxdb *sqlx.DB, bus bus.Bus) *SessionDB {
	return &SessionDB{sqlxdb: sqlxdb, bus: bus, logger: log.New("sqlx_session")}
}

func (gs *SessionDB) Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gs.sqlxdb.GetContext(ctx, dest, gs.sqlxdb.Rebind(query), args...)
}

func (gs *SessionDB) Select(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gs.sqlxdb.SelectContext(ctx, dest, gs.sqlxdb.Rebind(query), args...)
}

func (gs *SessionDB) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return gs.sqlxdb.ExecContext(ctx, gs.sqlxdb.Rebind(query), args...)
}

func (gs *SessionDB) NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error) {
	return gs.sqlxdb.NamedExecContext(ctx, gs.sqlxdb.Rebind(query), arg)
}

func (gs *SessionDB) driverName() string {
	return gs.sqlxdb.DriverName()
}

func (gs *SessionDB) Beginx() (*SessionTx, error) {
	tx, err := gs.sqlxdb.Beginx()
	return &SessionTx{sqlxtx: tx}, err
}

func (gs *SessionDB) WithTransaction(ctx context.Context, callback func(*SessionTx) error) error {
	// Instead of begin a transaction, we need to check the transaction in context, if it exists,
	// we can reuse it.
	tx, err := gs.Beginx()
	if err != nil {
		return err
	}
	err = callback(tx)
	if err != nil {
		if rbErr := tx.sqlxtx.Rollback(); rbErr != nil {
			return fmt.Errorf("tx err: %v, rb err: %v", err, rbErr)
		}
		return err
	}
	return tx.sqlxtx.Commit()
}

func (gs *SessionDB) ExecWithReturningId(ctx context.Context, query string, args ...interface{}) (int64, error) {
	return execWithReturningId(ctx, gs.driverName(), query, gs, args...)
}

func (gs *SessionDB) SqlxInTransactionWithRetry(ctx context.Context, fn func(ctx context.Context) error, retry int) error {
	return sqlxInTransactionWithRetryCtx(ctx, gs, gs.bus, func(tx *SessionTx) error {
		withValue := context.WithValue(ctx, ContextSQLxTransactionKey{}, tx)
		return fn(withValue)
	}, retry, gs.logger)
}

func sqlxInTransactionWithRetryCtx(ctx context.Context, sess *SessionDB, bus bus.Bus, callback SQLxDBTransactionFunc, retry int, logger log.Logger) error {
	trans, isNew, err := sqlxStartTransactionOrUseExisting(ctx, sess, logger)
	if err != nil {
		return err
	}

	if !trans.transactionOpen && !isNew {
		// this should not happen because the only place that creates reusable session begins a new transaction.
		return fmt.Errorf("cannot reuse existing session that did not start transaction")
	}

	err = callback(trans)

	if !isNew {
		logger.Debug("skip committing the transaction because it belongs to a session created in the outer scope")
		// Do not commit the transaction if the session was reused.
		return err
	}

	// special handling of database locked errors for sqlite, then we can retry 5 times
	var sqlError sqlite3.Error
	if errors.As(err, &sqlError) && retry < 5 && (sqlError.Code == sqlite3.ErrLocked || sqlError.Code == sqlite3.ErrBusy) {
		if rollErr := trans.sqlxtx.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
		}

		time.Sleep(time.Millisecond * time.Duration(10))
		logger.Info("Database locked, sleeping then retrying", "error", err, "retry", retry)
		return sqlxInTransactionWithRetryCtx(ctx, sess, bus, callback, retry+1, logger)
	}

	if err != nil {
		if rollErr := trans.sqlxtx.Rollback(); rollErr != nil {
			return fmt.Errorf("rolling back transaction due to error failed: %s: %w", rollErr, err)
		}
		return err
	}
	if isNew { // if this call initiated the session, it should be responsible for committing it.
		if err = trans.sqlxtx.Commit(); err != nil {
			return err
		}
	}

	if len(trans.events) > 0 {
		for _, e := range trans.events {
			if err = bus.Publish(ctx, e); err != nil {
				logger.Error("Failed to publish event after commit.", "error", err)
			}
		}
	}

	return nil
}

func sqlxStartTransactionOrUseExisting(ctx context.Context, sess *SessionDB, logger log.Logger) (*SessionTx, bool, error) {
	value := ctx.Value(ContextSQLxTransactionKey{})
	var trans *SessionTx
	trans, ok := value.(*SessionTx)

	if ok {
		logger.Debug("reusing existing session", "transaction", trans.transactionOpen)
		return trans, false, nil
	}

	tx, err := sess.Beginx()
	if err != nil {
		return nil, false, err
	}
	tx.transactionOpen = true
	return tx, true, nil
}

type SessionTx struct {
	sqlxtx          *sqlx.Tx
	transactionOpen bool
	events          []interface{}
}

func (gtx *SessionTx) NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error) {
	return gtx.sqlxtx.NamedExecContext(ctx, gtx.sqlxtx.Rebind(query), arg)
}

func (gtx *SessionTx) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return gtx.sqlxtx.ExecContext(ctx, gtx.sqlxtx.Rebind(query), args...)
}

func (gtx *SessionTx) Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gtx.sqlxtx.GetContext(ctx, dest, gtx.sqlxtx.Rebind(query), args...)
}

func (gtx *SessionTx) driverName() string {
	return gtx.sqlxtx.DriverName()
}

func (gtx *SessionTx) ExecWithReturningId(ctx context.Context, query string, args ...interface{}) (int64, error) {
	return execWithReturningId(ctx, gtx.driverName(), query, gtx, args...)
}

func execWithReturningId(ctx context.Context, driverName string, query string, sess Session, args ...interface{}) (int64, error) {
	supported := false
	var id int64
	if driverName == "postgres" {
		query = fmt.Sprintf("%s RETURNING id", query)
		supported = true
	}
	if supported {
		err := sess.Get(ctx, &id, query, args...)
		if err != nil {
			return id, err
		}
		return id, nil
	} else {
		res, err := sess.Exec(ctx, query, args...)
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
