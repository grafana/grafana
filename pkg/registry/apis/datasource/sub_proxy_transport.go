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
	"github.com/hashicorp/golang-lru/v2/simplelru"
)

type proxyTransportKey struct{ namespace, plugin, uid string }

type cachedProxyTransport struct {
	fingerprint [sha256.Size]byte
	transport   http.RoundTripper
	closeIdle   func()
}

// Bound retained transports while leaving idle connection expiry to net/http.
type proxyTransportCache struct {
	mu      sync.Mutex
	entries *simplelru.LRU[proxyTransportKey, *cachedProxyTransport]
	closed  bool
}

func newProxyTransportCache(size int) *proxyTransportCache {
	entries, err := simplelru.NewLRU[proxyTransportKey, *cachedProxyTransport](size, func(_ proxyTransportKey, entry *cachedProxyTransport) {
		entry.closeIdle()
	})
	if err != nil {
		panic(err)
	}
	return &proxyTransportCache{entries: entries}
}

func (c *proxyTransportCache) get(key proxyTransportKey, fingerprint [sha256.Size]byte, build func() (http.RoundTripper, func(), error)) (http.RoundTripper, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil, errors.New("datasource proxy transport cache is closed")
	}
	if entry, ok := c.entries.Get(key); ok {
		if entry.fingerprint == fingerprint {
			return entry.transport, nil
		}
		c.entries.Remove(key)
	}
	// Serialize construction so concurrent requests for a datasource share one pool.
	rt, closeIdle, err := build()
	if err != nil {
		closeIdle()
		return nil, err
	}
	entry := &cachedProxyTransport{fingerprint: fingerprint, transport: rt, closeIdle: closeIdle}
	c.entries.Add(key, entry)
	return rt, nil
}

func (c *proxyTransportCache) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.closed = true
	c.entries.Purge()
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

// HTTPClientOptions fills absent datasource values from SDK globals. Replace
// only those defaults with the current tenant's values; preserve explicit overrides.
func applyProxyTimeoutDefaults(opts *sdkhttpclient.Options, data map[string]json.RawMessage, defaults sdkhttpclient.TimeoutOptions) {
	t := *opts.Timeouts
	if _, ok := data["timeout"]; !ok {
		t.Timeout = defaults.Timeout
	}
	if _, ok := data["dialTimeout"]; !ok {
		t.DialTimeout = defaults.DialTimeout
	}
	if _, ok := data["httpKeepAlive"]; !ok {
		t.KeepAlive = defaults.KeepAlive
	}
	if _, ok := data["httpTLSHandshakeTimeout"]; !ok {
		t.TLSHandshakeTimeout = defaults.TLSHandshakeTimeout
	}
	if _, ok := data["httpExpectContinueTimeout"]; !ok {
		t.ExpectContinueTimeout = defaults.ExpectContinueTimeout
	}
	if _, ok := data["httpMaxConnsPerHost"]; !ok {
		t.MaxConnsPerHost = defaults.MaxConnsPerHost
	}
	if _, ok := data["httpMaxIdleConns"]; !ok {
		t.MaxIdleConns = defaults.MaxIdleConns
	}
	if _, ok := data["httpMaxIdleConnsPerHost"]; !ok {
		t.MaxIdleConnsPerHost = defaults.MaxIdleConnsPerHost
	}
	if _, ok := data["httpIdleConnTimeout"]; !ok {
		t.IdleConnTimeout = defaults.IdleConnTimeout
	}
	opts.Timeouts = &t
}
