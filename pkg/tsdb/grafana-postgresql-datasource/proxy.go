package postgres

import (
	"context"
	"net"

	"golang.org/x/net/proxy"
)

type PgxDialFunc = func(ctx context.Context, network string, address string) (net.Conn, error)

func newPgxDialFunc(dialer proxy.Dialer) PgxDialFunc {
	dialFunc :=
		func(ctx context.Context, network string, addr string) (net.Conn, error) {
			return dialer.Dial(network, addr)
		}

	return dialFunc
}
