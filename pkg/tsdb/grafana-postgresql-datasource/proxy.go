package postgres

import (
	"context"
	"net"
	"time"

	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/lib/pq"
	"golang.org/x/net/proxy"
)

// newPostgresProxyDriver updates the dialer for a postgres connector with a dialer that proxies connections through the secure socks proxy
// and returns a new postgres driver to register
func newPostgresProxyDialer(opts *sdkproxy.Options) (pq.Dialer, error) {
	dialer, err := sdkproxy.New(opts).NewSecureSocksProxyContextDialer()
	if err != nil {
		return nil, err
	}

	// update the postgres dialer with the proxy dialer
	return &postgresProxyDialer{d: dialer}, nil
}

var _ pq.Dialer = (&postgresProxyDialer{})

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
