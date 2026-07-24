package mysql

import (
	"context"
	"crypto/md5"
	"fmt"
	"net"

	"github.com/go-sql-driver/mysql"
	"golang.org/x/net/proxy"
)

// registerProxyDialerContext registers a new dialer context to be used by mysql when the proxy network is
// specified in the connection string
func registerProxyDialerContext(protocol, cnnstr string, dialer proxy.Dialer) (string, error) {
	// the mysqlDialer contains the true network used behind the scenes
	mysqlDialer, err := getProxyDialerContext(protocol, dialer)
	if err != nil {
		return "", err
	}

	// the dialer context can be updated everytime the datasource is updated
	// have a unique network per connection string
	hash := fmt.Sprintf("%x", md5.Sum([]byte(cnnstr)))
	network := "proxy-" + hash
	mysql.RegisterDialContext(network, mysqlDialer.DialContext)

	return network, nil
}

// mySQLContextDialer turns a golang proxy driver into a MySQL proxy driver
type mySQLContextDialer struct {
	dialer  proxy.ContextDialer
	network string
}

// getProxyDialerContext returns a context dialer that will send the request through to the secure socks proxy
func getProxyDialerContext(actualNetwork string, dialer proxy.Dialer) (*mySQLContextDialer, error) {
	contextDialer, ok := dialer.(proxy.ContextDialer)
	if !ok {
		return nil, fmt.Errorf("mysql proxy creation failed")
	}
	return &mySQLContextDialer{dialer: contextDialer, network: actualNetwork}, nil
}

// DialContext implements the MySQL requirements for a proxy driver, and uses the underlying golang proxy driver with the assigned network
func (d *mySQLContextDialer) DialContext(ctx context.Context, addr string) (net.Conn, error) {
	return d.dialer.DialContext(ctx, d.network, addr)
}
