package mssql

import (
	"context"
	"fmt"
	"net"
	"testing"

	mssql "github.com/microsoft/go-mssqldb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/proxy"
)

type testDialer struct {
}

func (d *testDialer) Dial(network, addr string) (c net.Conn, err error) {
	return nil, fmt.Errorf("test-dialer: Dial is not functional")
}

func (d *testDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	return nil, fmt.Errorf("test-dialer: DialContext is not functional")
}

var _ proxy.Dialer = (&testDialer{})
var _ proxy.ContextDialer = (&testDialer{})

func newTestDialer() proxy.Dialer {
	d := testDialer{}
	return &d
}

func TestMSSQLProxyDriver(t *testing.T) {
	cnnstr := "server=127.0.0.1;port=1433;user id=sa;password=yourStrong(!)Password;database=db"
	driverName, err := createMSSQLProxyDriver(cnnstr, "127.0.0.1", newTestDialer())
	require.NoError(t, err)

	t.Run("Driver should not be registered more than once", func(t *testing.T) {
		testDriver, err := createMSSQLProxyDriver(cnnstr, "127.0.0.1", newTestDialer())
		require.NoError(t, err)
		require.Equal(t, driverName, testDriver)
	})

	t.Run("A new driver should be created for a new connection string", func(t *testing.T) {
		testDriver, err := createMSSQLProxyDriver("server=localhost;user id=sa;password=yourStrong(!)Password;database=db2", "localhost", newTestDialer())
		require.NoError(t, err)
		require.NotEqual(t, driverName, testDriver)
	})

	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)
		driver, err := newMSSQLProxyDriver(connector, "127.0.0.1", newTestDialer())
		require.NoError(t, err)

		conn, err := driver.OpenConnector(cnnstr)
		require.NoError(t, err)

		_, err = conn.Connect(context.Background())
		require.Contains(t, err.Error(), "test-dialer: DialContext is not functional")
	})

	t.Run("Open should use the connector that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)
		driver, err := newMSSQLProxyDriver(connector, "127.0.0.1", newTestDialer())
		require.NoError(t, err)

		_, err = driver.Open(cnnstr)
		require.Contains(t, err.Error(), "test-dialer: DialContext is not functional")
	})
}
