package mssql

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"testing"

	mssql "github.com/microsoft/go-mssqldb"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/proxy"
)

type testDialer struct {
	Host string
}

func (d *testDialer) Dial(network, addr string) (c net.Conn, err error) {
	return nil, fmt.Errorf("test-dialer: Dial is not functional")
}

func (d *testDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	hostWithPort := d.HostName() + ":1433"
	if address != hostWithPort {
		return nil, fmt.Errorf("test-dialer: address does not match hostname")
	}
	return nil, fmt.Errorf("test-dialer: DialContext is not functional")
}

func (d *testDialer) HostName() string {
	return d.Host
}

var _ proxy.Dialer = (&testDialer{})

func TestMSSQLProxyDriver(t *testing.T) {
	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		host := "127.0.0.1"
		cnnstr := fmt.Sprintf("server=%s;port=1433;user id=sa;password=yourStrong(!)Password;database=db", host)
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)

		td := testDialer{
			Host: host,
		}
		dialer, err := newMSSQLProxyDialer("%s", &td)
		require.NoError(t, err)

		connector.Dialer = (dialer)

		db := sql.OpenDB(connector)
		err = db.Ping()

		require.Contains(t, err.Error(), "test-dialer: DialContext is not functional")
	})

	t.Run("Connector should use hostname rather than attempting to resolve IP", func(t *testing.T) {
		host := "www.grafana.com"
		cnnstr := fmt.Sprintf("server=%s;port=1433;user id=sa;password=yourStrong(!)Password;database=db", host)
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)

		td := testDialer{
			Host: host,
		}
		dialer, err := newMSSQLProxyDialer(host, &td)
		require.NoError(t, err)

		connector.Dialer = (dialer)

		db := sql.OpenDB(connector)
		err = db.Ping()

		require.Contains(t, err.Error(), "test-dialer: DialContext is not functional")
	})
}
