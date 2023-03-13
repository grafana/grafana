package mssql

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"

	mssql "github.com/denisenkom/go-mssqldb"
	iproxy "github.com/grafana/grafana/pkg/infra/proxy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/util"
	"golang.org/x/net/proxy"
	"xorm.io/core"
)

// createMSSQLProxyDriver creates and registers a new sql driver that uses a mssql connector and updates the dialer to
// route connections through the secure socks proxy
func createMSSQLProxyDriver(settings *setting.SecureSocksDSProxySettings, cnnstr string) (string, error) {
	sqleng.XormDriverMu.Lock()
	defer sqleng.XormDriverMu.Unlock()

	// create a unique driver per connection string
	hash, err := util.Md5SumString(cnnstr)
	if err != nil {
		return "", err
	}
	driverName := "mssql-proxy-" + hash

	// only register the driver once
	if core.QueryDriver(driverName) == nil {
		connector, err := mssql.NewConnector(cnnstr)
		if err != nil {
			return "", err
		}

		driver, err := newMSSQLProxyDriver(settings, connector)
		if err != nil {
			return "", err
		}
		sql.Register(driverName, driver)
		core.RegisterDriver(driverName, driver)
	}

	return driverName, nil
}

// mssqlProxyDriver is a regular mssql driver with an updated dialer.
// This is needed because there is no way to save a dialer to the mssql driver in xorm
type mssqlProxyDriver struct {
	c *mssql.Connector
}

var _ driver.DriverContext = (*mssqlProxyDriver)(nil)
var _ core.Driver = (*mssqlProxyDriver)(nil)

// newMSSQLProxyDriver updates the dialer for a mssql connector with a dialer that proxys connections through the secure socks proxy
// and returns a new mssql driver to register
func newMSSQLProxyDriver(cfg *setting.SecureSocksDSProxySettings, connector *mssql.Connector) (*mssqlProxyDriver, error) {
	dialer, err := iproxy.NewSecureSocksProxyContextDialer(cfg)
	if err != nil {
		return nil, err
	}

	contextDialer, ok := dialer.(proxy.ContextDialer)
	if !ok {
		return nil, errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}

	connector.Dialer = contextDialer
	return &mssqlProxyDriver{c: connector}, nil
}

// Parse uses the xorm mssql dialect for the driver (this has to be implemented to register the driver with xorm)
func (d *mssqlProxyDriver) Parse(a string, b string) (*core.Uri, error) {
	sqleng.XormDriverMu.RLock()
	defer sqleng.XormDriverMu.RUnlock()

	return core.QueryDriver("mssql").Parse(a, b)
}

// OpenConnector returns the normal mssql connector that has the updated dialer context
func (d *mssqlProxyDriver) OpenConnector(name string) (driver.Connector, error) {
	return d.c, nil
}

// Open uses the connector with the updated dialer context to open a new connection
func (d *mssqlProxyDriver) Open(dsn string) (driver.Conn, error) {
	return d.c.Connect(context.Background())
}
