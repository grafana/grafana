package postgres

import (
	"context"
	"net"

	"golang.org/x/net/proxy"
)

type DialFunc = func(ctx context.Context, network string, address string) (net.Conn, error)

func newDialFunc(dialer proxy.Dialer) DialFunc {
	return func(ctx context.Context, network string, addr string) (net.Conn, error) {
		return dialer.Dial(network, addr)
	}
}
