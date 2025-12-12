package dbimpl

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestDB_BeginTx(t *testing.T) {
	t.Parallel()
	registerTestSQLDrivers()
	ctx := testutil.NewDefaultTestContext(t)

	sqlDB, err := sql.Open(driverWithIsolationLevelName, "")
	require.NoError(t, err)
	require.NotNil(t, sqlDB)

	d := NewDB(sqlDB, driverWithIsolationLevelName)
	require.Equal(t, driverWithIsolationLevelName, d.DriverName())

	tx, err := d.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, tx)
}

func TestDB_BeginTx_RetriesOnTimeout(t *testing.T) {
	t.Parallel()

	// Register a driver that times out on the first two connection attempts
	driverName := "test-timeout-driver-" + t.Name()
	timeoutDriver := &timeoutTestDriver{
		timeoutsRemaining: 2,
	}
	sql.Register(driverName, timeoutDriver)

	sqlDB, err := sql.Open(driverName, "")
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	d := NewDB(sqlDB, driverName)

	// Use a longer timeout context since we expect retries with backoff
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	tx, err := d.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.NotNil(t, tx)

	// Should have attempted 3 connections (2 timeouts + 1 success)
	require.Equal(t, int32(3), timeoutDriver.connAttempts.Load())
}

func TestDB_BeginTx_ConnectionReleasedAfterCommitAndRollback(t *testing.T) {
	t.Parallel()

	// Register a driver that tracks open connections
	driverName := "test-conn-tracking-driver-" + t.Name()
	trackingDriver := &connTrackingDriver{}
	sql.Register(driverName, trackingDriver)

	sqlDB, err := sql.Open(driverName, "")
	require.NoError(t, err)
	// Setting MaxIdleConns to 0 ensures connections are closed when returned to pool
	sqlDB.SetMaxIdleConns(0)
	sqlDB.SetMaxOpenConns(1)

	d := NewDB(sqlDB, driverName)
	ctx := testutil.NewDefaultTestContext(t)

	// Test Commit releases connection
	tx1, err := d.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.Equal(t, int32(1), trackingDriver.openConns.Load(), "should have 1 open connection after BeginTx")

	err = tx1.Commit()
	require.NoError(t, err)
	require.Equal(t, int32(0), trackingDriver.openConns.Load(), "should have 0 open connections after Commit")

	// Test Rollback releases connection
	tx2, err := d.BeginTx(ctx, nil)
	require.NoError(t, err)
	require.Equal(t, int32(1), trackingDriver.openConns.Load(), "should have 1 open connection after BeginTx")

	err = tx2.Rollback()
	require.NoError(t, err)
	require.Equal(t, int32(0), trackingDriver.openConns.Load(), "should have 0 open connections after Rollback")
}

// timeoutTestDriver simulates connection timeouts for testing retry logic
type timeoutTestDriver struct {
	mu                sync.Mutex
	timeoutsRemaining int
	connAttempts      atomic.Int32
}

func (d *timeoutTestDriver) Open(name string) (driver.Conn, error) {
	return d.connect(context.Background())
}

func (d *timeoutTestDriver) OpenConnector(name string) (driver.Connector, error) {
	return &timeoutTestConnector{driver: d}, nil
}

func (d *timeoutTestDriver) connect(ctx context.Context) (driver.Conn, error) {
	d.connAttempts.Add(1)

	d.mu.Lock()
	shouldTimeout := d.timeoutsRemaining > 0
	if shouldTimeout {
		d.timeoutsRemaining--
	}
	d.mu.Unlock()

	if shouldTimeout {
		// Block until context is cancelled to simulate a slow connection
		<-ctx.Done()
		return nil, ctx.Err()
	}

	return &timeoutTestConn{}, nil
}

type timeoutTestConnector struct {
	driver *timeoutTestDriver
}

func (c *timeoutTestConnector) Connect(ctx context.Context) (driver.Conn, error) {
	return c.driver.connect(ctx)
}

func (c *timeoutTestConnector) Driver() driver.Driver {
	return c.driver
}

type timeoutTestConn struct{}

func (c *timeoutTestConn) Prepare(query string) (driver.Stmt, error) { return testStmt{}, nil }
func (c *timeoutTestConn) Close() error                              { return nil }
func (c *timeoutTestConn) Begin() (driver.Tx, error)                 { return testTx{}, nil }
func (c *timeoutTestConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return testTx{}, nil
}

// connTrackingDriver tracks open connections for testing connection lifecycle
type connTrackingDriver struct {
	openConns atomic.Int32
}

func (d *connTrackingDriver) Open(name string) (driver.Conn, error) {
	d.openConns.Add(1)
	return &connTrackingConn{driver: d}, nil
}

func (d *connTrackingDriver) OpenConnector(name string) (driver.Connector, error) {
	return &connTrackingConnector{driver: d}, nil
}

type connTrackingConnector struct {
	driver *connTrackingDriver
}

func (c *connTrackingConnector) Connect(ctx context.Context) (driver.Conn, error) {
	c.driver.openConns.Add(1)
	return &connTrackingConn{driver: c.driver}, nil
}

func (c *connTrackingConnector) Driver() driver.Driver {
	return c.driver
}

type connTrackingConn struct {
	driver *connTrackingDriver
}

func (c *connTrackingConn) Prepare(query string) (driver.Stmt, error) { return testStmt{}, nil }
func (c *connTrackingConn) Close() error {
	c.driver.openConns.Add(-1)
	return nil
}
func (c *connTrackingConn) Begin() (driver.Tx, error) { return testTx{}, nil }
func (c *connTrackingConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return testTx{}, nil
}
