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
)

const proxyTransportIdleTimeout = 5 * time.Minute

type proxyTransportKey struct{ namespace, plugin, uid string }

type cachedProxyTransport struct {
	fingerprint [sha256.Size]byte
	transport   http.RoundTripper
	closeIdle   func()
	lastUsed    time.Time
}

// Expiry tracks cache lookups; closing idle connections leaves active requests running.
type proxyTransportCache struct {
	mu      sync.Mutex
	entries map[proxyTransportKey]*cachedProxyTransport
	closed  bool
	stop    chan struct{}
	done    chan struct{}
}

func newProxyTransportCache() *proxyTransportCache {
	c := &proxyTransportCache{
		entries: make(map[proxyTransportKey]*cachedProxyTransport),
		stop:    make(chan struct{}),
		done:    make(chan struct{}),
	}
	go func() {
		defer close(c.done)
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				c.expire()
			case <-c.stop:
				return
			}
		}
	}()
	return c
}

func (c *proxyTransportCache) get(key proxyTransportKey, fingerprint [sha256.Size]byte, build func() (http.RoundTripper, func(), error)) (http.RoundTripper, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return nil, errors.New("datasource proxy transport cache is closed")
	}
	if entry, ok := c.entries[key]; ok {
		if entry.fingerprint == fingerprint && time.Since(entry.lastUsed) < proxyTransportIdleTimeout {
			entry.lastUsed = time.Now()
			return entry.transport, nil
		}
		entry.closeIdle()
		delete(c.entries, key)
	}
	// Serialize construction so concurrent requests for a datasource share one pool.
	rt, closeIdle, err := build()
	if err != nil {
		closeIdle()
		return nil, err
	}
	c.entries[key] = &cachedProxyTransport{fingerprint: fingerprint, transport: rt, closeIdle: closeIdle, lastUsed: time.Now()}
	return rt, nil
}

func (c *proxyTransportCache) expire() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key, entry := range c.entries {
		if time.Since(entry.lastUsed) >= proxyTransportIdleTimeout {
			entry.closeIdle()
			delete(c.entries, key)
		}
	}
}

func (c *proxyTransportCache) close() {
	c.mu.Lock()
	if !c.closed {
		c.closed = true
		close(c.stop)
		for key, entry := range c.entries {
			entry.closeIdle()
			delete(c.entries, key)
		}
	}
	c.mu.Unlock()
	<-c.done
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
