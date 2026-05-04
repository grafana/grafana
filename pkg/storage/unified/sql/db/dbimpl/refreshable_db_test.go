package dbimpl

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// authErrorDB is a test db.DB that always returns an auth error on BeginTx.
type authErrorDB struct {
	callCount int
	authErr   error
	successDB db.DB
}

func (d *authErrorDB) BeginTx(ctx context.Context, opts *sql.TxOptions) (db.Tx, error) {
	d.callCount++
	if d.callCount == 1 {
		return nil, d.authErr
	}
	return d.successDB.BeginTx(ctx, opts)
}

func (d *authErrorDB) WithTx(ctx context.Context, opts *sql.TxOptions, f db.TxFunc) error {
	return errors.New("not implemented")
}

func (d *authErrorDB) ExecContext(ctx context.Context, query string, args ...any) (db.Result, error) {
	return nil, errors.New("not implemented")
}

func (d *authErrorDB) QueryContext(ctx context.Context, query string, args ...any) (db.Rows, error) {
	return nil, errors.New("not implemented")
}

func (d *authErrorDB) QueryRowContext(ctx context.Context, query string, args ...any) db.Row {
	return nil
}

func (d *authErrorDB) PingContext(ctx context.Context) error { return nil }

func (d *authErrorDB) Stats() sql.DBStats { return sql.DBStats{} }

func (d *authErrorDB) DriverName() string { return "postgres" }

func (d *authErrorDB) SqlDB() *sql.DB { return nil }

// mockRefreshFunc is a simple refresh function for testing.
type mockRefreshFunc struct {
	callCount int
	err       error
	newDB     db.DB
}

func (m *mockRefreshFunc) refresh() (db.DB, error) {
	m.callCount++
	return m.newDB, m.err
}

func TestRefreshableDB_PassesThroughOnSuccess(t *testing.T) {
	registerTestSQLDrivers()
	ctx := testutil.NewDefaultTestContext(t)

	sqlDB, err := sql.Open(driverWithoutIsolationLevelName, "")
	require.NoError(t, err)
	inner := NewDB(sqlDB, driverWithoutIsolationLevelName)

	refreshFn := &mockRefreshFunc{newDB: inner}
	rdb := newRefreshableDB(inner, refreshFn.refresh)

	tx, err := rdb.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, tx)
	require.NoError(t, tx.Rollback())
	assert.Equal(t, 0, refreshFn.callCount, "no refresh should occur on success")
}

func TestRefreshableDB_RefreshesOnAuthError(t *testing.T) {
	registerTestSQLDrivers()
	ctx := testutil.NewDefaultTestContext(t)

	sqlDB, err := sql.Open(driverWithoutIsolationLevelName, "")
	require.NoError(t, err)
	successDB := NewDB(sqlDB, driverWithoutIsolationLevelName)

	authErr := errors.New("password authentication failed for user")
	failOnceDB := &authErrorDB{authErr: authErr, successDB: successDB}

	refreshFn := &mockRefreshFunc{newDB: successDB}
	// For the refresh to swap inner, after refresh the failOnceDB must succeed on 2nd call.
	rdb := newRefreshableDB(failOnceDB, refreshFn.refresh)

	tx, err := rdb.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, tx)
	require.NoError(t, tx.Rollback())
	assert.Equal(t, 1, refreshFn.callCount, "refresh should be called once on auth error")
}

func TestRefreshableDB_DoesNotRefreshOnNonAuthError(t *testing.T) {
	ctx := context.Background()

	nonAuthErr := errors.New("connection timeout")
	failDB := &authErrorDB{authErr: nonAuthErr}

	refreshFn := &mockRefreshFunc{}
	rdb := newRefreshableDB(failDB, refreshFn.refresh)

	_, err := rdb.BeginTx(ctx, nil)
	require.Error(t, err)
	assert.Equal(t, 0, refreshFn.callCount, "no refresh on non-auth error")
}
