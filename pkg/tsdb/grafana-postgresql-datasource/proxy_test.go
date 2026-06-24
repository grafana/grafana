package postgres

import (
	"fmt"
	"net"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
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
		config, err := pgxpool.ParseConfig(cnnstr)
		require.NoError(t, err)

		config.ConnConfig.DialFunc = newDialFunc(&testDialer{})

		pool, err := pgxpool.NewWithConfig(t.Context(), config)
		require.NoError(t, err)
		defer pool.Close()

		err = pool.Ping(t.Context())
		require.Error(t, err)
		require.Contains(t, err.Error(), "test-dialer is not functional")
	})
}
