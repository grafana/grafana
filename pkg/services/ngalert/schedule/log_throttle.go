package schedule

import "time"

// staleLogInterval is how often a rule may log the same kind of stale marker problem.
const staleLogInterval = 5 * time.Minute

// logThrottle lets one line through per interval and counts the ones it held back.
// It is not safe for concurrent use: a rule only logs from its own goroutine.
type logThrottle struct {
	next       time.Time
	suppressed int
}

// allow reports whether to log at now. When it does, suppressed is how many calls
// were held back since the last line.
func (t *logThrottle) allow(now time.Time) (suppressed int, ok bool) {
	if now.Before(t.next) {
		t.suppressed++
		return 0, false
	}
	suppressed, t.suppressed = t.suppressed, 0
	t.next = now.Add(staleLogInterval)
	return suppressed, true
}
