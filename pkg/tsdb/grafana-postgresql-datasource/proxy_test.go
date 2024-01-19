package postgres

import (
	"database/sql"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/tsdb/sqleng/proxyutil"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestPostgresProxyDriver(t *testing.T) {
	settings := proxyutil.SetupTestSecureSocksProxySettings(t)
	proxySettings := setting.SecureSocksDSProxySettings{
		Enabled:      true,
		ClientCert:   settings.ClientCert,
		ClientKey:    settings.ClientKey,
		RootCA:       settings.RootCA,
		ProxyAddress: settings.ProxyAddress,
		ServerName:   settings.ServerName,
	}
	opts := proxyutil.GetSQLProxyOptions(proxySettings, sqleng.DataSourceInfo{UID: "1", JsonData: sqleng.JsonData{SecureDSProxy: true}}, "pg", "postgres")
	dbURL := "localhost:5432"
	cnnstr := fmt.Sprintf("postgres://auser:password@%s/db?sslmode=disable", dbURL)

	t.Run("Connector should use dialer context that routes through the socks proxy to db", func(t *testing.T) {
		connector, err := pq.NewConnector(cnnstr)
		require.NoError(t, err)
		dialer, err := newPostgresProxyDialer(opts)
		require.NoError(t, err)

		connector.Dialer(dialer)

		db := sql.OpenDB(connector)
		err = db.Ping()

		require.Contains(t, err.Error(), fmt.Sprintf("socks connect %s %s->%s", "tcp", settings.ProxyAddress, dbURL))
	})
}
