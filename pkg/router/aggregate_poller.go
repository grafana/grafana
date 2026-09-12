package router

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"log/slog"
)

// Defaults for aggregate-target polling. Not exposed as ini keys in this
// iteration -- see the plan's Global Constraints for why -- but isolated
// here so promoting them to config later touches one place.
const (
	// defaultAggregatePollInterval is the cooldown's steady-state interval --
	// the single source of truth for poll pacing while a target is healthy.
	// run() derives its timer from the cooldown alone; there is deliberately
	// no second, independent ticker at this interval (see run()).
	defaultAggregatePollInterval = 30 * time.Second
	defaultAggregateMinBackoff   = 5 * time.Second
	defaultAggregateMaxBackoff   = 5 * time.Minute

	// defaultAggregateDiscoveryTimeout bounds each discovery HTTP request so
	// a silent upstream (handshake completes, response never arrives) can't
	// hang poll() forever -- poll() runs synchronously in run()'s select
	// loop, so a stuck request would otherwise freeze that target's
	// discovery permanently. Generous for a discovery GET while leaving
	// headroom before the next steady-interval attempt.
	defaultAggregateDiscoveryTimeout = 10 * time.Second
)

// aggregateTarget owns one fixed upstream apiserver's discovery poll loop.
// Backends() is read by cloudLoader.Load() (any goroutine); run() is the
// sole writer of snapshot, on its own goroutine -- hence atomic.Pointer
// rather than a mutex.
type aggregateTarget struct {
	name     string
	base     *url.URL
	client   *http.Client
	patterns []*regexp.Regexp

	// cooldown is the only thing that paces run(): its steady interval is the
	// healthy re-poll cadence and its backoff is the post-failure retry
	// schedule. Written and read solely from run()'s goroutine.
	cooldown *cooldown

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]
}

func newAggregateTarget(cfg aggregateTargetConfig, client *http.Client) (*aggregateTarget, error) {
	base, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("router: parsing %s url %q: %w", cfg.Name, cfg.URL, err)
	}
	// url.Parse alone accepts empty and relative values without error (e.g.
	// "" or "/just/a/path" parse fine with no scheme/host). Reject those here,
	// at construction time -- otherwise the target is built, starts polling a
	// URL it can never reach, and the misconfiguration surfaces only as a
	// recurring background WARN instead of failing startup loudly. Same check
	// and rationale as NewForwardBackend's.
	if base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("router: %s url must be absolute (scheme and host required): url=%q", cfg.Name, cfg.URL)
	}
	// Normalize away a trailing slash so every path join off this base is
	// deterministic: a configured "https://host/" leaves Path="/", which
	// concatenates into "//apis" -- a different path than "/apis" to most
	// servers, silently breaking discovery for this target.
	base.Path = strings.TrimRight(base.Path, "/")

	patterns, err := compileGroupPatterns(cfg.GroupPatterns)
	if err != nil {
		return nil, err
	}
	t := &aggregateTarget{
		name:     cfg.Name,
		base:     base,
		client:   client,
		patterns: patterns,
		cooldown: newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
	}
	empty := []Backend{}
	t.snapshot.Store(&empty)
	emptyKeys := map[string]struct{}{}
	t.lastKeys.Store(&emptyKeys)
	return t, nil
}

// Backends returns the current discovered-and-filtered backend snapshot.
// Safe to call from any goroutine.
func (t *aggregateTarget) Backends() []Backend {
	return *t.snapshot.Load()
}

// run polls until ctx is done, paced entirely by t.cooldown. Signals dirty
// (non-blocking, coalescing -- matches cloudLoader.dirty's existing contract)
// only when the discovered key set actually changed, so a downed or unchanged
// target never triggers a needless reconcile.
//
// The timer is reset from the cooldown after every attempt, making the
// cooldown the one and only pacing source. An earlier version also ran a
// fixed-interval ticker and had poll() skip any tick the cooldown wasn't ready
// for: because the ticker's interval and the cooldown's steady interval are
// the same 30s, the two raced -- a tick arriving marginally early was silently
// dropped, pushing the real cadence out by a whole interval -- and, worse, the
// 5s/10s/20s... backoff ladder was completely masked, since a retry scheduled
// 5s out could not run until the outer 30s ticker next fired. Do not
// reintroduce a second timing source.
func (t *aggregateTarget) run(ctx context.Context, dirty chan<- struct{}) {
	timer := time.NewTimer(0) // fire immediately; don't wait an interval for the first attempt
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			t.poll(ctx, dirty)
			// poll always records either a success or a failure, so next is
			// scheduled off the attempt's own start time. A non-positive
			// remainder means the attempt itself outlasted the interval, in
			// which case firing straight away is the correct behaviour.
			timer.Reset(t.cooldown.Until(time.Now()))
		}
	}
}

// poll performs one discovery attempt and records its outcome on the
// cooldown, which is what schedules the next attempt. It deliberately does no
// pacing check of its own -- run()'s timer is the only gate (see run()).
func (t *aggregateTarget) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()

	groups, err := discoverGroups(ctx, t.client, t.base.String())
	if err != nil {
		t.cooldown.OnFailure(now)
		slog.Warn("router: aggregate discovery poll failed, backing off", "target", t.name, "err", err)
		return
	}
	t.cooldown.OnSuccess(now)

	backends := make([]Backend, 0, len(groups))
	keys := make(map[string]struct{}, len(groups))
	for _, group := range groups {
		if !matchesAnyPattern(group.Name, t.patterns) {
			continue
		}
		backend, err := newAggregateBackend(t.name, group, t.base, t.client.Transport)
		if err != nil {
			slog.Warn("router: skipping unfingerprintable discovered group", "target", t.name, "group", group.Name, "err", err)
			continue
		}
		backends = append(backends, backend)
		keys[backend.Key()] = struct{}{}
	}

	t.snapshot.Store(&backends)

	lastKeys := *t.lastKeys.Load()
	if !sameKeySet(lastKeys, keys) {
		t.lastKeys.Store(&keys)
		select {
		case dirty <- struct{}{}:
		default: // already pending; coalesce
		}
	}
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
