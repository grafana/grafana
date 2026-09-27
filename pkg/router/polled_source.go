package router

import (
	"context"
	"errors"
	"sync/atomic"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// errPollPending is a polled source's error until its first poll finishes.
var errPollPending = errors.New("router: source has not been polled yet")

// polledSource is a route source kept current by polling. It runs fetch on
// its cooldown, keeps the backends from the last successful fetch, and wakes
// the router when what it reports changes.
type polledSource struct {
	name  string
	fetch func(context.Context) ([]Backend, error)

	// cooldown is the only thing that paces run: its steady interval is the
	// healthy re-poll cadence and its backoff the retry schedule after a
	// failure. Read and written only by the polling goroutine.
	cooldown *cooldown
	status   pollStatus

	// latest is the outcome of the latest poll; nil until the first one.
	latest atomic.Pointer[polledResult]
}

type polledResult struct {
	backends []Backend // from the last successful poll
	err      error     // the latest poll's error, if it failed
}

func newPolledSource(name string, cooldown *cooldown, fetch func(context.Context) ([]Backend, error)) *polledSource {
	return &polledSource{name: name, fetch: fetch, cooldown: cooldown}
}

// Backends returns the backends from the last successful poll. Safe to call
// from any goroutine.
func (p *polledSource) Backends() []Backend {
	if latest := p.latest.Load(); latest != nil {
		return latest.backends
	}
	return nil
}

// current returns the last-known-good backends, with the latest poll's
// error, or errPollPending before the first poll finishes.
func (p *polledSource) current() ([]Backend, error) {
	latest := p.latest.Load()
	if latest == nil {
		return nil, errPollPending
	}
	return latest.backends, latest.err
}

// setBackends publishes backends as if a poll had returned them.
func (p *polledSource) setBackends(backends []Backend) {
	p.latest.Store(&polledResult{backends: backends})
}

// run polls until ctx is done, paced only by the cooldown. Do not add a
// second ticker: it races the cooldown and masks the backoff schedule.
func (p *polledSource) run(ctx context.Context, dirty chan<- struct{}) {
	timer := time.NewTimer(0) // the first poll runs at once
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			p.poll(ctx, dirty)
			timer.Reset(p.cooldown.Until(time.Now()))
		}
	}
}

// poll runs one fetch. A failed fetch keeps the last-known-good backends. It
// wakes the router only when what current reports can have changed: after the
// first poll, when the key set changes, or when polls start or stop failing.
func (p *polledSource) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()
	prev := p.latest.Load()

	next := &polledResult{}
	backends, err := p.fetch(ctx)
	if err != nil {
		p.cooldown.OnFailure(now)
		p.status.recordFailure()
		logging.FromContext(ctx).Warn("router: route source poll failed, keeping last-known-good routes", "source", p.name, "err", err)
		next.err = err
		if prev != nil {
			next.backends = prev.backends
		}
	} else {
		p.cooldown.OnSuccess(now)
		p.status.recordSuccess(now)
		next.backends = backends
	}
	p.latest.Store(next)

	if prev != nil && (prev.err == nil) == (next.err == nil) && sameKeySet(backendKeys(prev.backends), backendKeys(next.backends)) {
		return
	}
	select {
	case dirty <- struct{}{}:
	default: // already pending; coalesce
	}
}

func (p *polledSource) sourceStatus() sourceStatus {
	return p.status.status(p.name)
}

func backendKeys(backends []Backend) map[string]struct{} {
	keys := make(map[string]struct{}, len(backends))
	for _, b := range backends {
		keys[b.Key()] = struct{}{}
	}
	return keys
}

func sameKeySet(a, b map[string]struct{}) bool {
	if len(a) != len(b) {
		return false
	}
	for k := range a {
		if _, ok := b[k]; !ok {
			return false
		}
	}
	return true
}
