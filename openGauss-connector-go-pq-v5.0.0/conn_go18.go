// Copyright © 2021 Bin Liu <bin.liu@enmotech.com>

package pq

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"io"
	"io/ioutil"
	"time"
)

const (
	watchCancelDialContextTimeout = time.Second * 10
)

// QueryContext Implement the "QueryerContext" interface
func (cn *conn) QueryContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	list := make([]driver.Value, len(args))
	for i, nv := range args {
		list[i] = nv.Value
	}
	finish := cn.watchCancel(ctx)
	r, err := cn.query(query, list)
	if err != nil {
		if finish != nil {
			finish()
		}
		return nil, err
	}
	r.finish = finish
	return r, nil
}

// ExecContext Implement the "ExecerContext" interface
func (cn *conn) ExecContext(ctx context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	list := make([]driver.Value, len(args))
	for i, nv := range args {
		list[i] = nv.Value
	}

	if finish := cn.watchCancel(ctx); finish != nil {
		defer finish()
	}

	return cn.Exec(query, list)
}

// PrepareContext Implement the "ConnPrepareContext" interface
func (cn *conn) PrepareContext(ctx context.Context, query string) (driver.Stmt, error) {
	if finish := cn.watchCancel(ctx); finish != nil {
		defer finish()
	}
	return cn.Prepare(query)
}

// BeginTx Implement the "ConnBeginTx" interface
func (cn *conn) BeginTx(ctx context.Context, opts driver.TxOptions) (driver.Tx, error) {
	var mode string

	switch sql.IsolationLevel(opts.Isolation) {
	case sql.LevelDefault:
		// Don't touch mode: use the server's default
	case sql.LevelReadUncommitted:
		mode = " ISOLATION LEVEL READ UNCOMMITTED"
	case sql.LevelReadCommitted:
		mode = " ISOLATION LEVEL READ COMMITTED"
	case sql.LevelRepeatableRead:
		mode = " ISOLATION LEVEL REPEATABLE READ"
	case sql.LevelSerializable:
		mode = " ISOLATION LEVEL SERIALIZABLE"
	default:
		return nil, fmt.Errorf("pq: isolation level not supported: %d", opts.Isolation)
	}

	if opts.ReadOnly {
		mode += " READ ONLY"
	} else {
		mode += " READ WRITE"
	}

	tx, err := cn.begin(mode)
	if err != nil {
		return nil, err
	}
	cn.txnFinish = cn.watchCancel(ctx)
	return tx, nil
}

func (cn *conn) Ping(ctx context.Context) error {
	if finish := cn.watchCancel(ctx); finish != nil {
		defer finish()
	}
	rows, err := cn.simpleQuery(";")
	if err != nil {
		return driver.ErrBadConn // https://golang.org/pkg/database/sql/driver/#Pinger
	}
	rows.Close()
	return nil
}

func (cn *conn) watchCancel(ctx context.Context) func() {
	if done := ctx.Done(); done != nil {
		finished := make(chan struct{}, 1)
		go func() {
			select {
			case <-done:
				select {
				case finished <- struct{}{}:
				default:
					// We raced with the finish func, let the next query handle this with the
					// context.
					return
				}

				// Set the connection state to bad so it does not get reused.
				cn.err.set(ctx.Err())

				// At this point the function level context is canceled,
				// so it must not be used for the additional network
				// request to cancel the query.
				// Create a new context to pass into the dial.
				ctxCancel, cancel := context.WithTimeout(context.Background(), watchCancelDialContextTimeout)
				defer cancel()

				_ = cn.cancel(ctxCancel)
			case <-finished:
			}
		}()
		return func() {
			select {
			case <-finished:
				cn.err.set(ctx.Err())
				cn.Close()
			case finished <- struct{}{}:
			}
		}
	}
	return nil
}

func (cn *conn) cancel(ctx context.Context) error {
	// Create a new values map (copy). This makes sure the connection created
	// in this method cannot write to the same underlying data, which could
	// cause a concurrent map write panic. This is necessary because cancel
	// is called from a goroutine in watchCancel.

	network, address := NetworkAddress(cn.fallbackConfig.Host, cn.fallbackConfig.Port)
	c, err := cn.config.DialFunc(ctx, network, address)
	if err != nil {
		return err
	}
	defer c.Close()
	{
		can := conn{
			c: c,
		}
		can.scratch = make([]byte, cn.config.minReadBufferSize)
		if cn.fallbackConfig.TLSConfig != nil {
			if err := cn.startTLS(cn.fallbackConfig.TLSConfig); err != nil {
				cn.c.Close()
				return err
			}
		}
		w := can.writeBuf(0)
		w.int32(80877102) // cancel request code
		w.int32(cn.processID)
		w.int32(cn.secretKey)
		if err := can.sendStartupPacket(w); err != nil {
			return err
		}
	}

	// Read until EOF to ensure that the server received the cancel.
	{
		_, err := io.Copy(ioutil.Discard, c)
		return err
	}
}

// QueryContext Implement the "StmtQueryContext" interface
func (st *stmt) QueryContext(ctx context.Context, args []driver.NamedValue) (driver.Rows, error) {
	list := make([]driver.Value, len(args))
	for i, nv := range args {
		list[i] = nv.Value
	}
	finish := st.watchCancel(ctx)
	r, err := st.query(list)
	if err != nil {
		if finish != nil {
			finish()
		}
		return nil, err
	}
	r.finish = finish
	return r, nil
}

// ExecContext Implement the "StmtExecContext" interface
func (st *stmt) ExecContext(ctx context.Context, args []driver.NamedValue) (driver.Result, error) {
	list := make([]driver.Value, len(args))
	for i, nv := range args {
		list[i] = nv.Value
	}

	if finish := st.watchCancel(ctx); finish != nil {
		defer finish()
	}

	return st.Exec(list)
}

// watchCancel is implemented on stmt in order to not mark the parent conn as bad
func (st *stmt) watchCancel(ctx context.Context) func() {
	if done := ctx.Done(); done != nil {
		finished := make(chan struct{})
		go func() {
			select {
			case <-done:
				// At this point the function level context is canceled,
				// so it must not be used for the additional network
				// request to cancel the query.
				// Create a new context to pass into the dial.
				ctxCancel, cancel := context.WithTimeout(context.Background(), watchCancelDialContextTimeout)
				defer cancel()

				_ = st.cancel(ctxCancel)
				finished <- struct{}{}
			case <-finished:
			}
		}()
		return func() {
			select {
			case <-finished:
			case finished <- struct{}{}:
			}
		}
	}
	return nil
}

func (st *stmt) cancel(ctx context.Context) error {
	return st.cn.cancel(ctx)
}
