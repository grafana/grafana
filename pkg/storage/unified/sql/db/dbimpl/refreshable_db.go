package dbimpl

import (
	"context"
	"database/sql"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

const refreshableDBDebounce = 30 * time.Second

// refreshFn is a function that returns a fresh db.DB after credential rotation.
type refreshFn func() (db.DB, error)

// refreshableDB wraps a db.DB and intercepts BeginTx. On authentication errors
// it calls a caller-provided refresh function to obtain a new inner DB, then
// retries the operation once.
//
// It is only instantiated when PwdFilePath is non-empty, so it has zero impact
// on SQLite or static-credential deployments.
type refreshableDB struct {
	mu              sync.RWMutex
	inner           db.DB
	refresh         refreshFn
	lastRefreshTime time.Time
	db.WithTxFunc
}

// newRefreshableDB constructs a refreshableDB wrapping inner.
func newRefreshableDB(inner db.DB, refresh refreshFn) *refreshableDB {
	r := &refreshableDB{
		inner:   inner,
		refresh: refresh,
	}
	r.WithTxFunc = db.NewWithTxFunc(r.BeginTx)
	return r
}

// BeginTx delegates to the inner DB. On auth error, calls refresh() and retries once.
func (r *refreshableDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (db.Tx, error) {
	r.mu.RLock()
	inner := r.inner
	r.mu.RUnlock()

	tx, err := inner.BeginTx(ctx, opts)
	if err == nil {
		return tx, nil
	}

	if !sqlstore.IsAuthError(err) {
		return nil, err
	}

	// Auth error — attempt refresh with debounce.
	r.mu.Lock()
	if time.Since(r.lastRefreshTime) < refreshableDBDebounce {
		r.mu.Unlock()
		// Already refreshed recently; return the original error.
		return nil, err
	}

	newDB, refreshErr := r.refresh()
	if refreshErr != nil {
		r.mu.Unlock()
		return nil, err // return original auth error; log is up to caller
	}

	r.inner = newDB
	r.lastRefreshTime = time.Now()
	r.mu.Unlock()

	// Retry with the new inner DB.
	r.mu.RLock()
	inner = r.inner
	r.mu.RUnlock()

	return inner.BeginTx(ctx, opts)
}

// Forward all other db.DB methods to the current inner DB.

func (r *refreshableDB) ExecContext(ctx context.Context, query string, args ...any) (db.Result, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.ExecContext(ctx, query, args...)
}

func (r *refreshableDB) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.QueryContext(ctx, query, args...)
}

func (r *refreshableDB) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.QueryRowContext(ctx, query, args...)
}

func (r *refreshableDB) PingContext(ctx context.Context) error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.PingContext(ctx)
}

func (r *refreshableDB) Stats() sql.DBStats {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.Stats()
}

func (r *refreshableDB) DriverName() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.DriverName()
}

func (r *refreshableDB) SqlDB() *sql.DB {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.inner.SqlDB()
}
