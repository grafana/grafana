package postgres

import (
	"context"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/infra/proxy/proxyutil"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
	"xorm.io/core"
)

func TestPostgresProxyDriver(t *testing.T) {
	dialect := "postgres"
	settings := proxyutil.SetupTestSecureSocksProxySettings(t)
	dbURL := "localhost:5432"
	cnnstr := fmt.Sprintf("postgres://auser:password@%s/db?sslmode=disable", dbURL)
	driverName, err := createPostgresProxyDriver(settings, cnnstr)
	require.NoError(t, err)

	t.Run("Driver should not be registered more than once", func(t *testing.T) {
		testDriver, err := createPostgresProxyDriver(settings, cnnstr)
		require.NoError(t, err)
		require.Equal(t, driverName, testDriver)
	})

	t.Run("A new driver should be created for a new connection string", func(t *testing.T) {
		testDriver, err := createPostgresProxyDriver(settings, "server=localhost;user id=sa;password=yourStrong(!)Password;database=db2")
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
		connector, err := pq.NewConnector(cnnstr)
		require.NoError(t, err)
		driver, err := newPostgresProxyDriver(settings, connector)
		require.NoError(t, err)

		conn, err := driver.OpenConnector(cnnstr)
		require.NoError(t, err)

		_, err = conn.Connect(context.Background())
		require.Contains(t, err.Error(), fmt.Sprintf("socks connect %s %s->%s", "tcp", settings.ProxyAddress, dbURL))
	})

	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := pq.NewConnector(cnnstr)
		require.NoError(t, err)
		driver, err := newPostgresProxyDriver(settings, connector)
		require.NoError(t, err)

		conn, err := driver.OpenConnector(cnnstr)
		require.NoError(t, err)

		_, err = conn.Connect(context.Background())
		require.Contains(t, err.Error(), fmt.Sprintf("socks connect %s %s->%s", "tcp", settings.ProxyAddress, dbURL))
	})
}
