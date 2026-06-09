package webhooks

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/time/rate"
)

func TestIPRateLimiterAllow(t *testing.T) {
	now := time.Unix(0, 0)

	t.Run("allows up to burst then rejects within the same instant", func(t *testing.T) {
		l := newIPRateLimiter(10, 20, 0)

		for i := 0; i < 20; i++ {
			assert.True(t, l.allow("1.2.3.4", now), "request %d should be allowed within burst", i)
		}
		assert.False(t, l.allow("1.2.3.4", now), "request beyond burst should be rejected")
	})

	t.Run("consumes one token per request", func(t *testing.T) {
		// burst of 3 means exactly 3 instantaneous requests are allowed.
		l := newIPRateLimiter(1, 3, 0)

		assert.True(t, l.allow("1.2.3.4", now))
		assert.True(t, l.allow("1.2.3.4", now))
		assert.True(t, l.allow("1.2.3.4", now))
		assert.False(t, l.allow("1.2.3.4", now))
	})

	t.Run("refills at the configured rps over time", func(t *testing.T) {
		l := newIPRateLimiter(10, 10, 0)

		for i := 0; i < 10; i++ {
			require.True(t, l.allow("1.2.3.4", now))
		}
		assert.False(t, l.allow("1.2.3.4", now))

		// After 1s at 10 rps, 10 tokens have refilled (capped at burst).
		later := now.Add(time.Second)
		for i := 0; i < 10; i++ {
			assert.True(t, l.allow("1.2.3.4", later), "request %d should be allowed after refill", i)
		}
		assert.False(t, l.allow("1.2.3.4", later))
	})

	t.Run("tracks each key independently", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, 0)

		assert.True(t, l.allow("1.1.1.1", now))
		assert.False(t, l.allow("1.1.1.1", now), "first key is now drained")

		assert.True(t, l.allow("2.2.2.2", now))
		assert.False(t, l.allow("2.2.2.2", now))
	})
}

func TestIPRateLimiterTTLSweep(t *testing.T) {
	l := newIPRateLimiter(1, 1, 0)
	start := time.Unix(0, 0)

	require.True(t, l.allow("1.1.1.1", start))
	require.Len(t, l.buckets, 1)

	// A request from another key past the sweep interval, with the first key
	// idle beyond its TTL, should evict the stale bucket.
	later := start.Add(defaultRateLimiterTTL + defaultRateLimiterSweep + time.Second)
	require.True(t, l.allow("2.2.2.2", later))

	_, ok := l.buckets["1.1.1.1"]
	assert.False(t, ok, "idle bucket should be evicted")
	_, ok = l.buckets["2.2.2.2"]
	assert.True(t, ok, "active bucket should remain")
	assert.Equal(t, len(l.buckets), l.order.Len(), "order list must stay in sync with the map")
}

func TestIPRateLimiterMaxBuckets(t *testing.T) {
	now := time.Unix(0, 0)

	t.Run("caps the number of tracked keys", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, 0)
		l.maxBuckets = 3

		l.allow("a", now)
		l.allow("b", now)
		l.allow("c", now)
		l.allow("d", now) // exceeds cap, should evict the oldest ("a")

		assert.Equal(t, 3, len(l.buckets))
		assert.Equal(t, 3, l.order.Len())
		_, ok := l.buckets["a"]
		assert.False(t, ok, "least-recently-seen key should be evicted")
	})

	t.Run("evicts least-recently-seen, not least-recently-inserted", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, 0)
		l.maxBuckets = 3

		l.allow("a", now)
		l.allow("b", now)
		l.allow("c", now)
		l.allow("a", now) // touch "a" so "b" is now the oldest
		l.allow("d", now) // should evict "b"

		_, ok := l.buckets["b"]
		assert.False(t, ok, "touched key should be retained over an untouched older one")
		_, ok = l.buckets["a"]
		assert.True(t, ok)
	})

	t.Run("eviction resets rather than denies an evicted client", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, 0)
		l.maxBuckets = 1

		assert.True(t, l.allow("victim", now))
		assert.False(t, l.allow("victim", now), "victim drained its single token")

		l.allow("attacker", now) // evicts "victim"

		// victim returns: it gets a fresh full bucket and is allowed, not denied.
		assert.True(t, l.allow("victim", now), "evicted client must not be locked out")
	})
}

func TestIPRateLimiterWrap(t *testing.T) {
	t.Run("passes allowed requests to the next handler", func(t *testing.T) {
		l := newIPRateLimiter(10, 20, 0)
		var called bool
		h := l.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusOK)
		}))

		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
		req.RemoteAddr = "1.2.3.4:5678"
		h.ServeHTTP(rec, req)

		assert.True(t, called)
		assert.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("returns 429 once the limit is exceeded", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, 0)
		var calls int
		h := l.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
		}))

		newReq := func() *http.Request {
			req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			req.RemoteAddr = "1.2.3.4:5678"
			return req
		}

		first := httptest.NewRecorder()
		h.ServeHTTP(first, newReq())
		assert.Equal(t, http.StatusOK, first.Code)

		second := httptest.NewRecorder()
		h.ServeHTTP(second, newReq())
		assert.Equal(t, http.StatusTooManyRequests, second.Code)
		assert.Equal(t, 1, calls, "blocked request must not reach the next handler")
	})

	t.Run("forged X-Forwarded-For cannot evade the limit by default", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, 0)
		var calls int
		h := l.wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
		}))

		// Same TCP peer, a different forged XFF on each request.
		for i, xff := range []string{"9.9.9.1", "9.9.9.2", "9.9.9.3"} {
			req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			req.RemoteAddr = "1.2.3.4:5678"
			req.Header.Set("X-Forwarded-For", xff)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if i == 0 {
				assert.Equal(t, http.StatusOK, rec.Code)
			} else {
				assert.Equal(t, http.StatusTooManyRequests, rec.Code, "forged XFF must not mint a new bucket")
			}
		}
		assert.Equal(t, 1, calls)
		assert.Equal(t, 1, len(l.buckets), "all requests must share one bucket keyed on the peer")
	})
}

func TestClientKey(t *testing.T) {
	tests := []struct {
		name       string
		proxyDepth int
		xff        string
		xRealIP    string
		remoteAddr string
		want       string
	}{
		{
			name:       "ignores forwarding headers and uses peer when depth is 0",
			proxyDepth: 0,
			xff:        "9.9.9.9",
			xRealIP:    "8.8.8.8",
			remoteAddr: "1.2.3.4:5678",
			want:       "1.2.3.4",
		},
		{
			name:       "prefers X-Real-Ip over X-Forwarded-For when trusted",
			proxyDepth: 1,
			xRealIP:    "8.8.8.8",
			xff:        "5.5.5.5, 6.6.6.6",
			remoteAddr: "10.0.0.1:5678",
			want:       "8.8.8.8",
		},
		{
			name:       "trims whitespace around X-Real-Ip",
			proxyDepth: 1,
			xRealIP:    "  8.8.8.8 ",
			remoteAddr: "10.0.0.1:5678",
			want:       "8.8.8.8",
		},
		{
			name:       "uses peer host when no port-stripping needed fails gracefully",
			proxyDepth: 0,
			remoteAddr: "1.2.3.4",
			want:       "1.2.3.4",
		},
		{
			name:       "with one trusted hop, uses the entry left of it",
			proxyDepth: 1,
			xff:        "5.5.5.5, 6.6.6.6",
			remoteAddr: "10.0.0.1:5678",
			want:       "5.5.5.5",
		},
		{
			name:       "trims whitespace around the chosen entry",
			proxyDepth: 1,
			xff:        "5.5.5.5 ,  6.6.6.6",
			remoteAddr: "10.0.0.1:5678",
			want:       "5.5.5.5",
		},
		{
			name:       "falls back to peer when chain is shorter than configured depth",
			proxyDepth: 2,
			xff:        "6.6.6.6",
			remoteAddr: "10.0.0.1:5678",
			want:       "10.0.0.1",
		},
		{
			name:       "falls back to peer when XFF is absent",
			proxyDepth: 1,
			remoteAddr: "10.0.0.1:5678",
			want:       "10.0.0.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := newIPRateLimiter(1, 1, 0)
			l.trustedProxyDepth = tt.proxyDepth
			req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			req.RemoteAddr = tt.remoteAddr
			if tt.xff != "" {
				req.Header.Set("X-Forwarded-For", tt.xff)
			}
			if tt.xRealIP != "" {
				req.Header.Set("X-Real-Ip", tt.xRealIP)
			}
			assert.Equal(t, tt.want, l.clientKey(req))
		})
	}
}

// Guards the documented invariant that burst must be >= rps, otherwise a single
// second's worth of allowed traffic would be throttled.
func TestRateLimiterDefaults(t *testing.T) {
	assert.GreaterOrEqual(t, defaultWebhookBurst, int(rate.Limit(defaultWebhookRPS)))
}

func TestNewWebhookConnectorRateLimit(t *testing.T) {
	t.Run("configured rps builds a limiter with burst twice the rate", func(t *testing.T) {
		c := NewWebhookConnector(false, nil, nil, prometheus.NewRegistry(), 0, 25)
		if assert.NotNil(t, c.rateLimiter) {
			assert.Equal(t, rate.Limit(25), c.rateLimiter.rps)
			assert.Equal(t, 50, c.rateLimiter.burst)
		}
	})

	t.Run("non-positive rps disables the limiter", func(t *testing.T) {
		for _, rps := range []int{0, -5} {
			c := NewWebhookConnector(false, nil, nil, prometheus.NewRegistry(), 0, rps)
			assert.Nil(t, c.rateLimiter, "rps=%d should leave the limiter disabled", rps)
		}
	})
}
