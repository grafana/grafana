package postgres

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"net"
	"time"

	iproxy "github.com/grafana/grafana/pkg/infra/proxy"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/util"
	"github.com/lib/pq"
	"golang.org/x/net/proxy"
	"xorm.io/core"
)

// createPostgresProxyDriver creates and registers a new sql driver that uses a postgres connector and updates the dialer to
// route connections through the secure socks proxy
func createPostgresProxyDriver(settings *setting.SecureSocksDSProxySettings, cnnstr string) (string, error) {
	sqleng.XormDriverMu.Lock()
	defer sqleng.XormDriverMu.Unlock()

	// create a unique driver per connection string
	hash, err := util.Md5SumString(cnnstr)
	if err != nil {
		return "", err
	}
	driverName := "postgres-proxy-" + hash

	// only register the driver once
	if core.QueryDriver(driverName) == nil {
		connector, err := pq.NewConnector(cnnstr)
		if err != nil {
			return "", err
		}

		driver, err := newPostgresProxyDriver(settings, connector)
		if err != nil {
			return "", err
		}

		sql.Register(driverName, driver)
		core.RegisterDriver(driverName, driver)
	}
	return driverName, nil
}

// postgresProxyDriver is a regular postgres driver with an updated dialer.
// This is done because there is no way to save a dialer to the postgres driver in xorm
type postgresProxyDriver struct {
	c *pq.Connector
}

var _ driver.DriverContext = (*postgresProxyDriver)(nil)
var _ core.Driver = (*postgresProxyDriver)(nil)

// newPostgresProxyDriver updates the dialer for a postgres connector with a dialer that proxys connections through the secure socks proxy
// and returns a new postgres driver to register
func newPostgresProxyDriver(cfg *setting.SecureSocksDSProxySettings, connector *pq.Connector) (*postgresProxyDriver, error) {
	dialer, err := iproxy.NewSecureSocksProxyContextDialer(cfg)
	if err != nil {
		return nil, err
	}

	// update the postgres dialer with the proxy dialer
	connector.Dialer(&postgresProxyDialer{d: dialer})

	return &postgresProxyDriver{connector}, nil
}

// postgresProxyDialer implements the postgres dialer using a proxy dialer, as their functions differ slightly
type postgresProxyDialer struct {
	d proxy.Dialer
}

// Dial uses the normal proxy dial function with the updated dialer
func (p *postgresProxyDialer) Dial(network, addr string) (c net.Conn, err error) {
	return p.d.Dial(network, addr)
}

// DialTimeout uses the normal postgres dial timeout function with the updated dialer
func (p *postgresProxyDialer) DialTimeout(network, address string, timeout time.Duration) (net.Conn, error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	return p.d.(proxy.ContextDialer).DialContext(ctx, network, address)
}

// Parse uses the xorm postgres dialect for the driver (this has to be implemented to register the driver with xorm)
func (d *postgresProxyDriver) Parse(a string, b string) (*core.Uri, error) {
	sqleng.XormDriverMu.RLock()
	defer sqleng.XormDriverMu.RUnlock()

	return core.QueryDriver("postgres").Parse(a, b)
}

// OpenConnector returns the normal postgres connector that has the updated dialer context
func (d *postgresProxyDriver) OpenConnector(name string) (driver.Connector, error) {
	return d.c, nil
}

// Open uses the connector with the updated dialer to open a new connection
func (d *postgresProxyDriver) Open(dsn string) (driver.Conn, error) {
	return d.c.Connect(context.Background())
}
