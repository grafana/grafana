package mssql

import (
	"context"
	"errors"
	"net"

	mssql "github.com/microsoft/go-mssqldb"
	"golang.org/x/net/proxy"
)

type HostTransportDialer struct {
	Dialer proxy.ContextDialer
	Host   string
}

func (m HostTransportDialer) HostName() string {
	return m.Host
}

func (m HostTransportDialer) DialContext(ctx context.Context, network string, addr string) (conn net.Conn, err error) {
	return m.Dialer.DialContext(ctx, network, addr)
}

// // we wrap the proxy.Dialer to become dialer that the mssql module accepts
func newMSSQLProxyDialer(hostName string, dialer proxy.Dialer) (mssql.Dialer, error) {
	contextDialer, ok := dialer.(proxy.ContextDialer)
	if !ok {
		return nil, errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}

	return &HostTransportDialer{contextDialer, hostName}, nil
}
