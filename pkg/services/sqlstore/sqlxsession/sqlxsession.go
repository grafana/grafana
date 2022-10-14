package sqlxsession

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/sqlstore/commonSession"
	"github.com/jmoiron/sqlx"

	"github.com/grafana/grafana/pkg/infra/log"
)

type ContextSQLxTransactionKey struct{}

type Session interface {
	Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error
	Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error)
	NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error)
}

type DBSession struct {
	sqlxdb *sqlx.DB
	bus    bus.Bus
	logger log.Logger
}

func GetSession(sqlxdb *sqlx.DB, bus bus.Bus) *DBSession {
	return &DBSession{sqlxdb: sqlxdb, bus: bus, logger: log.New("sqlx_session")}
}

func (gs *DBSession) Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gs.sqlxdb.GetContext(ctx, dest, gs.sqlxdb.Rebind(query), args...)
}

func (gs *DBSession) Select(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gs.sqlxdb.SelectContext(ctx, dest, gs.sqlxdb.Rebind(query), args...)
}

func (gs *DBSession) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return gs.sqlxdb.ExecContext(ctx, gs.sqlxdb.Rebind(query), args...)
}

func (gs *DBSession) NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error) {
	return gs.sqlxdb.NamedExecContext(ctx, gs.sqlxdb.Rebind(query), arg)
}

func (gs *DBSession) driverName() string {
	return gs.sqlxdb.DriverName()
}

func (gs *DBSession) Beginx() (*DBSessionTx, error) {
	tx, err := gs.sqlxdb.Beginx()
	return &DBSessionTx{sqlxtx: tx}, err
}

func (gs *DBSession) WithTransaction(ctx context.Context, callback func(*DBSessionTx) error) error {
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

func (gs *DBSession) ExecWithReturningId(ctx context.Context, query string, args ...interface{}) (int64, error) {
	return execWithReturningId(ctx, gs.driverName(), query, gs, args...)
}

// implements SessionGetter[*DBSessionTx]
func (gs *DBSession) StartSessionOrUseExisting(ctx context.Context, _ bool) (commonSession.Tx[*DBSessionTx], bool, error) {
	value := ctx.Value(ContextSQLxTransactionKey{})
	var trans *DBSessionTx
	trans, ok := value.(*DBSessionTx)

	if ok {
		logger.Debug("reusing existing session", "transaction", trans.transactionOpen)
		return trans, false, nil
	}

	tx, err := gs.Beginx()
	if err != nil {
		return nil, false, err
	}
	tx.transactionOpen = true
	return tx, true, nil
}

type DBSessionTx struct {
	sqlxtx          *sqlx.Tx
	transactionOpen bool
	events          []interface{}
}

func (gtx *DBSessionTx) ConcreteType() *DBSessionTx {
	return gtx
}

func (gtx *DBSessionTx) NamedExec(ctx context.Context, query string, arg interface{}) (sql.Result, error) {
	return gtx.sqlxtx.NamedExecContext(ctx, gtx.sqlxtx.Rebind(query), arg)
}

func (gtx *DBSessionTx) Exec(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
	return gtx.sqlxtx.ExecContext(ctx, gtx.sqlxtx.Rebind(query), args...)
}

func (gtx *DBSessionTx) Get(ctx context.Context, dest interface{}, query string, args ...interface{}) error {
	return gtx.sqlxtx.GetContext(ctx, dest, gtx.sqlxtx.Rebind(query), args...)
}

func (gtx *DBSessionTx) driverName() string {
	return gtx.sqlxtx.DriverName()
}

func (gtx *DBSessionTx) ExecWithReturningId(ctx context.Context, query string, args ...interface{}) (int64, error) {
	return execWithReturningId(ctx, gtx.driverName(), query, gtx, args...)
}

func (gtx *DBSessionTx) IsTransactionOpen() bool {
	return gtx.transactionOpen
}

func (gtx *DBSessionTx) Close() {
	gtx.transactionOpen = false
}

func (gtx *DBSessionTx) Commit() error {
	return gtx.sqlxtx.Commit()
}

func (gtx *DBSessionTx) Rollback() error {
	return gtx.sqlxtx.Rollback()
}

func (gtx *DBSessionTx) GetEvents() []interface{} {
	return gtx.events
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
