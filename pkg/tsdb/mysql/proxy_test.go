package mysql

import (
	"context"
	"fmt"
	"net"
	"testing"

	"github.com/go-sql-driver/mysql"
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

func TestMySQLProxyDialer(t *testing.T) {
	protocol := "tcp"
	dbURL := "localhost:5432"
	network, err := registerProxyDialerContext(protocol, dbURL, &testDialer{})
	require.NoError(t, err)
	driver := mysql.MySQLDriver{}
	cnnstr := fmt.Sprintf("test:test@%s(%s)/db",
		network,
		dbURL,
	)
	t.Run("Network is available", func(t *testing.T) {
		_, err = driver.OpenConnector(cnnstr)
		require.NoError(t, err)
	})

	t.Run("Multiple networks can be created", func(t *testing.T) {
		network, err := registerProxyDialerContext(protocol, dbURL, &testDialer{})
		require.NoError(t, err)
		cnnstr2 := fmt.Sprintf("test:test@%s(%s)/db",
			network,
			dbURL,
		)
		// both networks should exist
		_, err = driver.OpenConnector(cnnstr)
		require.NoError(t, err)
		_, err = driver.OpenConnector(cnnstr2)
		require.NoError(t, err)
	})

	t.Run("Connection should be routed through socks proxy to db", func(t *testing.T) {
		conn, err := driver.OpenConnector(cnnstr)
		require.NoError(t, err)
		_, err = conn.Connect(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "test-dialer: DialContext is not functional")
	})
}
