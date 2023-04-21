package mysql

import (
	"context"
	"fmt"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/tsdb/sqleng/proxyutil"
	"github.com/stretchr/testify/require"
)

func TestMySQLProxyDialer(t *testing.T) {
	settings := proxyutil.SetupTestSecureSocksProxySettings(t)

	protocol := "tcp"
	opts := proxyutil.GetSQLProxyOptions(sqleng.DataSourceInfo{UID: "1", JsonData: sqleng.JsonData{SecureDSProxy: true}})
	dbURL := "localhost:5432"
	network, err := registerProxyDialerContext(protocol, dbURL, opts)
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
		network, err := registerProxyDialerContext(protocol, dbURL, opts)
		cnnstr2 := fmt.Sprintf("test:test@%s(%s)/db",
			network,
			dbURL,
		)
		require.NoError(t, err)
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
