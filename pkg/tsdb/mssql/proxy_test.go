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
}

func (d *testDialer) Dial(network, addr string) (c net.Conn, err error) {
	return nil, fmt.Errorf("test-dialer: Dial is not functional")
}

func (d *testDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	return nil, fmt.Errorf("test-dialer: DialContext is not functional")
}

var _ proxy.Dialer = (&testDialer{})

func TestMSSQLProxyDriver(t *testing.T) {
	cnnstr := "server=127.0.0.1;port=1433;user id=sa;password=yourStrong(!)Password;database=db"

	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)
		dialer, err := newMSSQLProxyDialer("127.0.0.1", &testDialer{})
		require.NoError(t, err)

		connector.Dialer = (dialer)

		db := sql.OpenDB(connector)
		err = db.Ping()

		require.Contains(t, err.Error(), "test-dialer: DialContext is not functional")
	})
}
