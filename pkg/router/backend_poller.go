package router

import (
	"context"
	"sync/atomic"
	"time"
)

// backendPoller is the polling state the plugin manifests sources share: the
// cooldown that paces the poll loop, the poll status, the last-known-good
// backend snapshot and the key set that decides when to signal a change.
type backendPoller struct {
	cooldown *cooldown
	status   pollStatus

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]
}

// initPoller sets the default cooldown and an empty snapshot.
func (p *backendPoller) initPoller() {
	p.cooldown = newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff)
	empty := []Backend{}
	p.snapshot.Store(&empty)
	emptyKeys := map[string]struct{}{}
	p.lastKeys.Store(&emptyKeys)
}

// Backends returns the current polled-and-filtered backend snapshot. Safe
// to call from any goroutine.
func (p *backendPoller) Backends() []Backend {
	return *p.snapshot.Load()
}

// pollLoop calls poll until ctx is done, paced entirely by p.cooldown --
// identical shape to aggregateTarget.run; see that method's doc for why there
// is deliberately only one timing source. poll records its outcome on the
// cooldown.
func (p *backendPoller) pollLoop(ctx context.Context, poll func(context.Context)) {
	timer := time.NewTimer(0) // fire immediately; don't wait an interval for the first attempt
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			poll(ctx)
			timer.Reset(p.cooldown.Until(time.Now()))
		}
	}
}

// publish stores a successful poll's backends, keyed by keys, and signals
// dirty only when the key set changed. The signal coalesces with a pending one.
func (p *backendPoller) publish(backends []Backend, keys map[string]struct{}, skipped int, dirty chan<- struct{}) {
	p.snapshot.Store(&backends)
	p.status.recordSkipped(skipped)

	lastKeys := *p.lastKeys.Load()
	if !sameKeySet(lastKeys, keys) {
		p.lastKeys.Store(&keys)
		select {
		case dirty <- struct{}{}:
		default: // already pending; coalesce
		}
	}
}
