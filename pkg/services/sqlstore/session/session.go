package session

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
)

type Session interface {
	Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error)
}

type SessionDB struct {
	sqlxdb *sqlx.DB
}

func GetSession(sqlxdb *sqlx.DB) *SessionDB {
	return &SessionDB{sqlxdb: sqlxdb}
}

func (gs *SessionDB) Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gs.sqlxdb.GetContext(ctx, dest, gs.sqlxdb.Rebind(query), args...)
}

func (gs *SessionDB) Select(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gs.sqlxdb.SelectContext(ctx, dest, gs.sqlxdb.Rebind(query), args...)
}

func (gs *SessionDB) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return gs.sqlxdb.QueryContext(ctx, gs.sqlxdb.Rebind(query), args...)
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

type SessionTx struct {
	sqlxtx *sqlx.Tx
}

func (gtx *SessionTx) NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error) {
	return gtx.sqlxtx.NamedExecContext(ctx, gtx.sqlxtx.Rebind(query), arg)
}

func (gtx *SessionTx) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return gtx.sqlxtx.ExecContext(ctx, gtx.sqlxtx.Rebind(query), args...)
}

func (gtx *SessionTx) Query(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return gtx.sqlxtx.QueryContext(ctx, gtx.sqlxtx.Rebind(query), args...)
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
