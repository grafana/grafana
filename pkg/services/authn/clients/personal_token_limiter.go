package clients

import (
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patscope"
)

const (
	maxFailuresPerWindow = 10
	failureWindow        = time.Minute
	maxTrackedIPs        = 10000
)

// failureLimiter throttles repeated failed token authentications per client IP so the
// token space cannot be probed at high rate. Only failures are counted.
type failureLimiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	byIP   map[string]*failureEntry
}

type failureEntry struct {
	start time.Time
	count int
}

func newFailureLimiter(max int, window time.Duration) *failureLimiter {
	return &failureLimiter{max: max, window: window, byIP: map[string]*failureEntry{}}
}

func (l *failureLimiter) blocked(ip string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	w, ok := l.byIP[ip]
	if !ok {
		return false
	}
	if now.Sub(w.start) >= l.window {
		delete(l.byIP, ip)
		return false
	}
	return w.count >= l.max
}

func (l *failureLimiter) record(ip string, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	w, ok := l.byIP[ip]
	if ok && now.Sub(w.start) >= l.window {
		ok = false
	}
	if !ok {
		if len(l.byIP) >= maxTrackedIPs {
			for k, v := range l.byIP {
				if now.Sub(v.start) >= l.window {
					delete(l.byIP, k)
				}
			}
			if len(l.byIP) >= maxTrackedIPs {
				return
			}
		}
		l.byIP[ip] = &failureEntry{start: now, count: 1}
		return
	}
	w.count++
}

func requestIP(r *authn.Request) string {
	if r == nil || r.HTTPRequest == nil {
		return ""
	}
	return patscope.ClientIP(r.HTTPRequest, patscope.TrustedProxies{})
}
