package postgres

import (
	"database/sql"
	"fmt"
	"net"
	"testing"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/proxy"
)

type testDialer struct {
}

func (d *testDialer) Dial(network, addr string) (c net.Conn, err error) {
	return nil, fmt.Errorf("test-dialer is not functional")
}

var _ proxy.Dialer = (&testDialer{})

func TestPostgresProxyDriver(t *testing.T) {
	dbURL := "localhost:5432"
	cnnstr := fmt.Sprintf("postgres://auser:password@%s/db?sslmode=disable", dbURL)

	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := pq.NewConnector(cnnstr)
		require.NoError(t, err)
		dialer := newPostgresProxyDialer(&testDialer{})

		connector.Dialer(dialer)

		db := sql.OpenDB(connector)
		err = db.Ping()

		require.Contains(t, err.Error(), "test-dialer is not functional")
	})
}
