package mysql

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/tsdb/sqleng/utils"
	"github.com/stretchr/testify/require"
)

func TestMySQLProxyDialer(t *testing.T) {
	settings := utils.SetupTestSecureSocksProxySettings(t)

	protocol := "tcp"
	network, err := registerProxyDialerContext(protocol, "1", "1")
	require.NoError(t, err)
	driver := mysql.MySQLDriver{}
	dbURL := "localhost:5432"
	cnnstr := fmt.Sprintf("test:test@%s(%s)/db",
		network,
		dbURL,
	)
	t.Run("Network is available", func(t *testing.T) {
		_, err = driver.OpenConnector(cnnstr)
		require.NoError(t, err)
	})

	t.Run("Multiple networks can be created", func(t *testing.T) {
		network, err := registerProxyDialerContext(protocol, "2", "2")
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
		require.Contains(t, err.Error(), fmt.Sprintf("socks connect %s %s->%s", protocol, settings.ProxyAddress, dbURL))
	})
}
