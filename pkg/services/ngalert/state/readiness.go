package state

import (
	"errors"
	"sync/atomic"
	"time"

	"github.com/benbjohnson/clock"
)

// ErrNotReady is returned by ProcessEvalResults when the state cache is not ready and within its
// grace window; the caller should treat it as a skipped, not a failed, evaluation.
var ErrNotReady = errors.New("state cache is not ready")

// Readiness reports whether a consumer may proceed.
type Readiness int

const (
	// Ready means the probe is ready — proceed normally.
	Ready Readiness = iota
	// NotReady means the probe is not ready yet — hold.
	NotReady
	// TimedOut means the probe is not ready but the grace window elapsed — proceed anyway.
	TimedOut
)

// defaultReadinessTimeout is used when a gated probe is created without an explicit timeout.
const defaultReadinessTimeout = 2 * time.Minute

// ReadinessProbe reports whether a consumer may proceed.
type ReadinessProbe interface {
	// Ready reports the current readiness.
	Ready() Readiness
	// MarkReady records that the probe is now ready.
	MarkReady()
	// Reset returns the probe to not-ready, restarting the grace window.
	Reset()
}

// AlwaysReady is a ReadinessProbe that is always ready.
type AlwaysReady struct{}

func (AlwaysReady) Ready() Readiness { return Ready }
func (AlwaysReady) MarkReady()       {}
func (AlwaysReady) Reset()           {}

// gatedProbe starts not-ready and becomes ready once MarkReady is called. A grace timeout reports
// ready anyway if that never happens, so a stuck dependency cannot block a consumer forever.
type gatedProbe struct {
	clock   clock.Clock
	timeout time.Duration
	since   atomic.Int64 // unix nanos
	ready   atomic.Bool
}

// newGatedProbe returns a probe that starts not-ready. A timeout <= 0 uses the default.
func newGatedProbe(clk clock.Clock, timeout time.Duration) *gatedProbe {
	if timeout <= 0 {
		timeout = defaultReadinessTimeout
	}
	p := &gatedProbe{clock: clk, timeout: timeout}
	p.since.Store(clk.Now().UnixNano())
	return p
}

func (p *gatedProbe) Ready() Readiness {
	if p.ready.Load() {
		return Ready
	}
	if p.clock.Since(time.Unix(0, p.since.Load())) >= p.timeout {
		return TimedOut
	}
	return NotReady
}

func (p *gatedProbe) MarkReady() { p.ready.Store(true) }

// Reset returns the probe to not-ready and restarts the grace window from now.
func (p *gatedProbe) Reset() {
	p.since.Store(p.clock.Now().UnixNano())
	p.ready.Store(false)
}
