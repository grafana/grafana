package datasource

import (
	"crypto/sha256"
	"encoding/json"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/maypok86/otter/v2"
)

const proxyTransportIdleTimeout = 5 * time.Minute

type proxyTransportKey struct{ namespace, plugin, uid string }

type cachedProxyTransport struct {
	fingerprint [sha256.Size]byte
	transport   http.RoundTripper
	closeIdle   func()
}

// Expiry tracks cache lookups; closing idle connections leaves active requests running.
type proxyTransportCache struct {
	mu      sync.Mutex
	entries *otter.Cache[proxyTransportKey, *cachedProxyTransport]
	closed  bool
}

func newProxyTransportCache() *proxyTransportCache {
	entries := otter.Must(&otter.Options[proxyTransportKey, *cachedProxyTransport]{
		ExpiryCalculator: otter.ExpiryAccessing[proxyTransportKey, *cachedProxyTransport](proxyTransportIdleTimeout),
		OnAtomicDeletion: func(e otter.DeletionEvent[proxyTransportKey, *cachedProxyTransport]) {
			e.Value.closeIdle()
		},
	})
	return &proxyTransportCache{entries: entries}
}

func (c *proxyTransportCache) get(key proxyTransportKey, fingerprint [sha256.Size]byte, build func() (http.RoundTripper, func(), error)) (http.RoundTripper, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil, errors.New("datasource proxy transport cache is closed")
	}
	if entry, ok := c.entries.GetIfPresent(key); ok {
		if entry.fingerprint == fingerprint {
			return entry.transport, nil
		}
		c.entries.Invalidate(key)
	}
	// Serialize construction so concurrent requests for a datasource share one pool.
	rt, closeIdle, err := build()
	if err != nil {
		closeIdle()
		return nil, err
	}
	c.entries.Set(key, &cachedProxyTransport{fingerprint: fingerprint, transport: rt, closeIdle: closeIdle})
	return rt, nil
}

func (c *proxyTransportCache) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	c.closed = true
	c.entries.InvalidateAll()
	c.entries.StopAllGoroutines()
}

func proxyTransportFingerprint(settings *backend.DataSourceInstanceSettings, opts sdkhttpclient.Options, configKey string) ([sha256.Size]byte, error) {
	// MT may synthesize Updated at read time. Hash the actual settings, including
	// credentials, instead. Only the digest is retained as a cache fingerprint.
	stable := *settings
	stable.Updated = time.Time{}
	data, err := json.Marshal(struct {
		Settings backend.DataSourceInstanceSettings
		Timeouts *sdkhttpclient.TimeoutOptions
		TLS      *sdkhttpclient.TLSOptions
		Proxy    *proxy.Options
		Config   string
	}{stable, opts.Timeouts, opts.TLS, opts.ProxyOptions, configKey})
	if err != nil {
		return [sha256.Size]byte{}, err
	}
	return sha256.Sum256(data), nil
}
