package mssql

import (
	"context"
	"crypto/md5"
	"database/sql"
	"database/sql/driver"
	"errors"
	"fmt"
	"net"
	"slices"

	mssql "github.com/microsoft/go-mssqldb"
	"golang.org/x/net/proxy"
)

// createMSSQLProxyDriver creates and registers a new sql driver that uses a mssql connector and updates the dialer to
// route connections through the secure socks proxy
func createMSSQLProxyDriver(cnnstr string, hostName string, dialer proxy.Dialer) (string, error) {
	// create a unique driver per connection string
	hash := fmt.Sprintf("%x", md5.Sum([]byte(cnnstr)))
	driverName := "mssql-proxy-" + hash

	// only register the driver once
	if !slices.Contains(sql.Drivers(), driverName) {
		connector, err := mssql.NewConnector(cnnstr)
		if err != nil {
			return "", err
		}

		driver, err := newMSSQLProxyDriver(connector, hostName, dialer)
		if err != nil {
			return "", err
		}
		sql.Register(driverName, driver)
	}

	return driverName, nil
}

type HostTransportDialer struct {
	Dialer proxy.ContextDialer
	Host   string
}

func (m HostTransportDialer) DialContext(ctx context.Context, network string, addr string) (conn net.Conn, err error) {
	return m.Dialer.DialContext(ctx, network, addr)
}

func (m HostTransportDialer) HostName() string {
	return m.Host
}

// mssqlProxyDriver is a regular mssql driver with an updated dialer.
// This is needed because there is no way to save a dialer to the mssql driver in xorm
type mssqlProxyDriver struct {
	c *mssql.Connector
}

var _ driver.DriverContext = (*mssqlProxyDriver)(nil)

// newMSSQLProxyDriver updates the dialer for a mssql connector with a dialer that proxys connections through the secure socks proxy
// and returns a new mssql driver to register
func newMSSQLProxyDriver(connector *mssql.Connector, hostName string, dialer proxy.Dialer) (*mssqlProxyDriver, error) {
	contextDialer, ok := dialer.(proxy.ContextDialer)
	if !ok {
		return nil, errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}

	connector.Dialer = HostTransportDialer{contextDialer, hostName}
	return &mssqlProxyDriver{c: connector}, nil
}

// OpenConnector returns the normal mssql connector that has the updated dialer context
func (d *mssqlProxyDriver) OpenConnector(name string) (driver.Connector, error) {
	return d.c, nil
}

// Open uses the connector with the updated dialer context to open a new connection
func (d *mssqlProxyDriver) Open(dsn string) (driver.Conn, error) {
	return d.c.Connect(context.Background())
}
