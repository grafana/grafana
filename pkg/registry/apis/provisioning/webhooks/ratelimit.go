package webhooks

import (
	"container/list"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	defaultWebhookRPS       = 10
	defaultWebhookBurst     = 20
	defaultRateLimiterTTL   = 10 * time.Minute
	defaultRateLimiterSweep = 1 * time.Minute
	// defaultMaxBuckets caps how many distinct client keys are tracked at once,
	// bounding memory regardless of request rate. At ~150 bytes per bucket this
	// is a few MB at the cap.
	defaultMaxBuckets = 50_000
)

type ipRateLimiter struct {
	rps             rate.Limit
	burst           int
	ttl             time.Duration
	maxBuckets      int
	trustedIPHeader string

	mu        sync.Mutex
	buckets   map[string]*ipBucket
	order     *list.List // keys ordered by recency; front = most recent, back = least
	lastSweep time.Time
}

type ipBucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
	elem     *list.Element // position of this key in order
}

func newIPRateLimiter(rps rate.Limit, burst int, trustedIPHeader string) *ipRateLimiter {
	return &ipRateLimiter{
		rps:             rps,
		burst:           burst,
		ttl:             defaultRateLimiterTTL,
		maxBuckets:      defaultMaxBuckets,
		trustedIPHeader: trustedIPHeader,
		buckets:         make(map[string]*ipBucket),
		order:           list.New(),
	}
}

func (l *ipRateLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.sweep(now)

	b, ok := l.buckets[key]
	if !ok {
		// Once at capacity, evict the least-recently-seen key. Eviction only
		// resets that peer's limiter (its next request starts a fresh bucket),
		// so it never denies a legitimate client — it just bounds memory.
		if len(l.buckets) >= l.maxBuckets {
			l.evictOldest()
		}
		b = &ipBucket{limiter: rate.NewLimiter(l.rps, l.burst)}
		b.elem = l.order.PushFront(key)
		l.buckets[key] = b
	} else {
		l.order.MoveToFront(b.elem)
	}
	b.lastSeen = now
	return b.limiter.AllowN(now, 1)
}

// sweep evicts buckets idle beyond the TTL. It runs at most once per sweep
// interval so the scan cost is amortized across requests.
func (l *ipRateLimiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) <= defaultRateLimiterSweep {
		return
	}
	for k, b := range l.buckets {
		if now.Sub(b.lastSeen) > l.ttl {
			l.order.Remove(b.elem)
			delete(l.buckets, k)
		}
	}
	l.lastSweep = now
}

func (l *ipRateLimiter) evictOldest() {
	back := l.order.Back()
	if back == nil {
		return
	}
	key := back.Value.(string)
	l.order.Remove(back)
	delete(l.buckets, key)
}

func (l *ipRateLimiter) wrap(tenant string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(l.clientKey(tenant, r), time.Now()) {
			http.Error(w, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// clientKey derives the rate-limiting key: the tenant (request namespace) joined
// with the client IP. The endpoint is multi-tenant, so keying on the namespace
// isolates tenants — a burst from one tenant cannot throttle another's
// deliveries. The IP component keeps a direct attacker in a separate bucket from
// GitHub's shared egress IPs within the same tenant, so throttling the attacker
// does not 429 (and thereby drop) that tenant's legitimate webhook events.
func (l *ipRateLimiter) clientKey(tenant string, r *http.Request) string {
	return tenant + "|" + l.clientIP(r)
}

// clientIP resolves the address used to bucket the caller. When trustedIPHeader
// is empty (the default) the real TCP peer (RemoteAddr) is always used, so no
// client-supplied header can move the key. When set, it names the header the
// fronting proxy sets to the resolved client IP, overwriting any client-injected
// value; that header is the key, falling back to the peer when it is absent on a
// request. Only the configured header is consulted — no other forwarding header
// (e.g. X-Forwarded-For) is, since trusting a positional entry in a
// client-controlled list is spoofable.
func (l *ipRateLimiter) clientIP(r *http.Request) string {
	peer := remoteHost(r.RemoteAddr)
	if l.trustedIPHeader == "" {
		return peer
	}
	if ip := strings.TrimSpace(r.Header.Get(l.trustedIPHeader)); ip != "" {
		return ip
	}
	return peer
}

func remoteHost(remoteAddr string) string {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		return remoteAddr
	}
	return host
}
