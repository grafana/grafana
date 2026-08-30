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
		l := newIPRateLimiter(10, 20, "")

		for i := 0; i < 20; i++ {
			assert.True(t, l.Allow("1.2.3.4", now), "request %d should be allowed within burst", i)
		}
		assert.False(t, l.Allow("1.2.3.4", now), "request beyond burst should be rejected")
	})

	t.Run("consumes one token per request", func(t *testing.T) {
		// burst of 3 means exactly 3 instantaneous requests are allowed.
		l := newIPRateLimiter(1, 3, "")

		assert.True(t, l.Allow("1.2.3.4", now))
		assert.True(t, l.Allow("1.2.3.4", now))
		assert.True(t, l.Allow("1.2.3.4", now))
		assert.False(t, l.Allow("1.2.3.4", now))
	})

	t.Run("refills at the configured rps over time", func(t *testing.T) {
		l := newIPRateLimiter(10, 10, "")

		for i := 0; i < 10; i++ {
			require.True(t, l.Allow("1.2.3.4", now))
		}
		assert.False(t, l.Allow("1.2.3.4", now))

		// After 1s at 10 rps, 10 tokens have refilled (capped at burst).
		later := now.Add(time.Second)
		for i := 0; i < 10; i++ {
			assert.True(t, l.Allow("1.2.3.4", later), "request %d should be allowed after refill", i)
		}
		assert.False(t, l.Allow("1.2.3.4", later))
	})

	t.Run("tracks each key independently", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, "")

		assert.True(t, l.Allow("1.1.1.1", now))
		assert.False(t, l.Allow("1.1.1.1", now), "first key is now drained")

		assert.True(t, l.Allow("2.2.2.2", now))
		assert.False(t, l.Allow("2.2.2.2", now))
	})
}

func TestIPRateLimiterTTLSweep(t *testing.T) {
	l := newIPRateLimiter(1, 1, "")
	start := time.Unix(0, 0)

	require.True(t, l.Allow("1.1.1.1", start))
	require.Len(t, l.buckets, 1)

	// A request from another key past the sweep interval, with the first key
	// idle beyond its TTL, should evict the stale bucket.
	later := start.Add(defaultRateLimiterTTL + defaultRateLimiterSweep + time.Second)
	require.True(t, l.Allow("2.2.2.2", later))

	_, ok := l.buckets["1.1.1.1"]
	assert.False(t, ok, "idle bucket should be evicted")
	_, ok = l.buckets["2.2.2.2"]
	assert.True(t, ok, "active bucket should remain")
	assert.Equal(t, len(l.buckets), l.order.Len(), "order list must stay in sync with the map")
}

func TestIPRateLimiterMaxBuckets(t *testing.T) {
	now := time.Unix(0, 0)

	t.Run("caps the number of tracked keys", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, "")
		l.maxBuckets = 3

		l.Allow("a", now)
		l.Allow("b", now)
		l.Allow("c", now)
		l.Allow("d", now) // exceeds cap, should evict the oldest ("a")

		assert.Equal(t, 3, len(l.buckets))
		assert.Equal(t, 3, l.order.Len())
		_, ok := l.buckets["a"]
		assert.False(t, ok, "least-recently-seen key should be evicted")
	})

	t.Run("evicts least-recently-seen, not least-recently-inserted", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, "")
		l.maxBuckets = 3

		l.Allow("a", now)
		l.Allow("b", now)
		l.Allow("c", now)
		l.Allow("a", now) // touch "a" so "b" is now the oldest
		l.Allow("d", now) // should evict "b"

		_, ok := l.buckets["b"]
		assert.False(t, ok, "touched key should be retained over an untouched older one")
		_, ok = l.buckets["a"]
		assert.True(t, ok)
	})

	t.Run("eviction resets rather than denies an evicted client", func(t *testing.T) {
		l := newIPRateLimiter(1, 1, "")
		l.maxBuckets = 1

		assert.True(t, l.Allow("victim", now))
		assert.False(t, l.Allow("victim", now), "victim drained its single token")

		l.Allow("attacker", now) // evicts "victim"

		// victim returns: it gets a fresh full bucket and is allowed, not denied.
		assert.True(t, l.Allow("victim", now), "evicted client must not be locked out")
	})
}

func TestIPRateLimiterWrap(t *testing.T) {
	t.Run("passes allowed requests to the next handler", func(t *testing.T) {
		l := newIPRateLimiter(10, 20, "")
		var called bool
		h := l.Wrap("ns1", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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
		l := newIPRateLimiter(1, 1, "")
		var calls int
		h := l.Wrap("ns1", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
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

	t.Run("forged forwarding headers cannot evade the limit when no header is trusted", func(t *testing.T) {
		// With no trusted header configured the limiter keys on the TCP peer, so
		// forged headers are ignored: every request from one peer shares a bucket.
		l := newIPRateLimiter(1, 1, "")
		var calls int
		h := l.Wrap("ns1", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls++
		}))

		for i := range 3 {
			req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			req.RemoteAddr = "1.2.3.4:5678"
			req.Header.Set("X-Forwarded-For", "9.9.9.1, 9.9.9.2")
			req.Header.Set("X-Real-Ip", "8.8.8.8")
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if i == 0 {
				assert.Equal(t, http.StatusOK, rec.Code)
			} else {
				assert.Equal(t, http.StatusTooManyRequests, rec.Code, "forged headers must not mint a new bucket")
			}
		}
		assert.Equal(t, 1, calls)
		assert.Equal(t, 1, len(l.buckets), "all requests must share one bucket keyed on the peer")
	})
}

func TestClientKey(t *testing.T) {
	tests := []struct {
		name            string
		trustedIPHeader string
		xff             string
		xRealIP         string
		remoteAddr      string
		want            string
	}{
		{
			name:            "ignores headers and uses peer when no header is trusted",
			trustedIPHeader: "",
			xff:             "9.9.9.9",
			xRealIP:         "8.8.8.8",
			remoteAddr:      "1.2.3.4:5678",
			want:            "1.2.3.4",
		},
		{
			name:            "uses the trusted header value",
			trustedIPHeader: "X-Real-Ip",
			xRealIP:         "8.8.8.8",
			remoteAddr:      "10.0.0.1:5678",
			want:            "8.8.8.8",
		},
		{
			name:            "trims whitespace around the trusted header value",
			trustedIPHeader: "X-Real-Ip",
			xRealIP:         "  8.8.8.8 ",
			remoteAddr:      "10.0.0.1:5678",
			want:            "8.8.8.8",
		},
		{
			name:            "consults only the trusted header, not X-Forwarded-For",
			trustedIPHeader: "X-Real-Ip",
			xff:             "5.5.5.5, 6.6.6.6",
			remoteAddr:      "10.0.0.1:5678",
			want:            "10.0.0.1",
		},
		{
			name:            "falls back to peer when the trusted header is absent",
			trustedIPHeader: "X-Real-Ip",
			remoteAddr:      "10.0.0.1:5678",
			want:            "10.0.0.1",
		},
		{
			name:            "uses peer host when RemoteAddr has no port",
			trustedIPHeader: "",
			remoteAddr:      "1.2.3.4",
			want:            "1.2.3.4",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			l := newIPRateLimiter(1, 1, tt.trustedIPHeader)
			req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
			req.RemoteAddr = tt.remoteAddr
			if tt.xff != "" {
				req.Header.Set("X-Forwarded-For", tt.xff)
			}
			if tt.xRealIP != "" {
				req.Header.Set("X-Real-Ip", tt.xRealIP)
			}
			assert.Equal(t, tt.want, l.clientIP(req))
		})
	}
}

func TestClientKeyTenantScoping(t *testing.T) {
	l := newIPRateLimiter(1, 1, "")
	newReq := func() *http.Request {
		req := httptest.NewRequest(http.MethodPost, "/webhook", nil)
		req.RemoteAddr = "1.2.3.4:5678"
		return req
	}

	// Same client IP, different tenants must produce different keys so one
	// tenant's traffic cannot consume another's bucket.
	assert.NotEqual(t, l.clientKey("ns1", newReq()), l.clientKey("ns2", newReq()))
	assert.Equal(t, "ns1|1.2.3.4", l.clientKey("ns1", newReq()))
}

// Guards the documented invariant that burst must be >= rps, otherwise a single
// second's worth of allowed traffic would be throttled.
func TestRateLimiterDefaults(t *testing.T) {
	assert.GreaterOrEqual(t, defaultWebhookBurst, int(rate.Limit(defaultWebhookRPS)))
}

func TestNewConfiguredRateLimiter(t *testing.T) {
	t.Run("positive rps with a trusted header builds a limiter with burst twice the rate", func(t *testing.T) {
		l := NewConfiguredRateLimiter(25, "X-Real-Ip")
		if assert.NotNil(t, l) {
			impl := l.(*ipRateLimiterImpl)
			assert.Equal(t, rate.Limit(25), impl.rps)
			assert.Equal(t, 50, impl.burst)
			assert.Equal(t, "X-Real-Ip", impl.trustedIPHeader)
		}
	})

	t.Run("non-positive rps disables the limiter", func(t *testing.T) {
		assert.Nil(t, NewConfiguredRateLimiter(0, "X-Real-Ip"), "rps=%d should disable the limiter", 0)
		assert.Nil(t, NewConfiguredRateLimiter(-1, "X-Real-Ip"), "rps=%d should disable the limiter", -1)
	})

	t.Run("positive rps without a trusted header enables the limiter keyed on the peer", func(t *testing.T) {
		l := NewConfiguredRateLimiter(25, "")
		if assert.NotNil(t, l) {
			assert.Equal(t, "", l.(*ipRateLimiterImpl).trustedIPHeader, "no header means it keys on RemoteAddr")
		}
	})
}

func TestNewWebhookConnectorStoresRateLimiter(t *testing.T) {
	limiter := newIPRateLimiter(1, 1, "")
	c := NewWebhookConnector(false, nil, nil, prometheus.NewRegistry(), limiter)
	assert.Same(t, limiter, c.rateLimiter, "the passed-in limiter should be used as-is")

	c = NewWebhookConnector(false, nil, nil, prometheus.NewRegistry(), nil)
	assert.Nil(t, c.rateLimiter, "a nil limiter disables rate limiting")
}
