package session

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/jmoiron/sqlx"
)

type Session interface {
	Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error)
}

type SessionDB struct {
	sqlxdb *sqlx.DB
	bus    bus.Bus
}

func GetSession(sqlxdb *sqlx.DB, bus bus.Bus) *SessionDB {
	return &SessionDB{sqlxdb: sqlxdb, bus: bus}
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
	if err = tx.sqlxtx.Commit(); err != nil {
		return err
	}
	if len(tx.events) > 0 {
		for _, e := range tx.events {
			if err = gs.bus.Publish(ctx, e); err != nil {
				fmt.Println("Failed to publish event after commit.")
				// tsclogger.Error("Failed to publish event after commit.", "error", err)
			}
		}
	}
	return nil
}

func (gs *SessionDB) ExecWithReturningId(ctx context.Context, query string, args ...interface{}) (int64, error) {
	return execWithReturningId(ctx, gs.driverName(), query, gs, args...)
}

type SessionTx struct {
	sqlxtx *sqlx.Tx
	events []interface{}
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

func (gtx *SessionTx) PublishAfterCommit(msg interface{}) {
	gtx.events = append(gtx.events, msg)
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
