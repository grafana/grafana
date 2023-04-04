package mssql

import (
	"context"
	"fmt"
	"testing"

	mssql "github.com/grafana/go-mssqldb"
	"github.com/grafana/grafana/pkg/infra/proxy/proxyutil"
	"github.com/stretchr/testify/require"
	"xorm.io/core"
)

func TestMSSQLProxyDriver(t *testing.T) {
	settings := proxyutil.SetupTestSecureSocksProxySettings(t)
	dialect := "mssql"
	cnnstr := "server=127.0.0.1;port=1433;user id=sa;password=yourStrong(!)Password;database=db"
	driverName, err := createMSSQLProxyDriver(settings, cnnstr)
	require.NoError(t, err)

	t.Run("Driver should not be registered more than once", func(t *testing.T) {
		testDriver, err := createMSSQLProxyDriver(settings, cnnstr)
		require.NoError(t, err)
		require.Equal(t, driverName, testDriver)
	})

	t.Run("A new driver should be created for a new connection string", func(t *testing.T) {
		testDriver, err := createMSSQLProxyDriver(settings, "server=localhost;user id=sa;password=yourStrong(!)Password;database=db2")
		require.NoError(t, err)
		require.NotEqual(t, driverName, testDriver)
	})

	t.Run("Parse should have the same result as xorm mssql parse", func(t *testing.T) {
		xormDriver := core.QueryDriver(dialect)
		xormResult, err := xormDriver.Parse(dialect, cnnstr)
		require.NoError(t, err)

		xormNewDriver := core.QueryDriver(driverName)
		xormNewResult, err := xormNewDriver.Parse(dialect, cnnstr)
		require.NoError(t, err)
		require.Equal(t, xormResult, xormNewResult)
	})

	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)
		driver, err := newMSSQLProxyDriver(settings, connector)
		require.NoError(t, err)

		conn, err := driver.OpenConnector(cnnstr)
		require.NoError(t, err)

		_, err = conn.Connect(context.Background())
		require.Contains(t, err.Error(), fmt.Sprintf("socks connect tcp %s->127.0.0.1:1433", settings.ProxyAddress))
	})

	t.Run("Open should use the connector that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := mssql.NewConnector(cnnstr)
		require.NoError(t, err)
		driver, err := newMSSQLProxyDriver(settings, connector)
		require.NoError(t, err)

		_, err = driver.Open(cnnstr)
		require.Contains(t, err.Error(), fmt.Sprintf("socks connect tcp %s->127.0.0.1:1433", settings.ProxyAddress))
	})
}
