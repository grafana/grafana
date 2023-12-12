package postgres

import (
	"context"
	"crypto/md5"
	"database/sql"
	"database/sql/driver"
	"fmt"
	"net"
	"slices"
	"time"

	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/lib/pq"
	"golang.org/x/net/proxy"
)

// createPostgresProxyDriver creates and registers a new sql driver that uses a postgres connector and updates the dialer to
// route connections through the secure socks proxy
func createPostgresProxyDriver(cnnstr string, opts *sdkproxy.Options) (string, error) {
	// create a unique driver per connection string
	hash := fmt.Sprintf("%x", md5.Sum([]byte(cnnstr)))
	driverName := "postgres-proxy-" + hash

	// only register the driver once
	if !slices.Contains(sql.Drivers(), driverName) {
		connector, err := pq.NewConnector(cnnstr)
		if err != nil {
			return "", err
		}

		driver, err := newPostgresProxyDriver(connector, opts)
		if err != nil {
			return "", err
		}

		sql.Register(driverName, driver)
	}
	return driverName, nil
}

// postgresProxyDriver is a regular postgres driver with an updated dialer.
// This is done because there is no way to save a dialer to the postgres driver in xorm
type postgresProxyDriver struct {
	c *pq.Connector
}

var _ driver.DriverContext = (*postgresProxyDriver)(nil)

// newPostgresProxyDriver updates the dialer for a postgres connector with a dialer that proxies connections through the secure socks proxy
// and returns a new postgres driver to register
func newPostgresProxyDriver(connector *pq.Connector, opts *sdkproxy.Options) (*postgresProxyDriver, error) {
	dialer, err := sdkproxy.New(opts).NewSecureSocksProxyContextDialer()
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

// OpenConnector returns the normal postgres connector that has the updated dialer context
func (d *postgresProxyDriver) OpenConnector(name string) (driver.Connector, error) {
	return d.c, nil
}

// Open uses the connector with the updated dialer to open a new connection
func (d *postgresProxyDriver) Open(dsn string) (driver.Conn, error) {
	return d.c.Connect(context.Background())
}
