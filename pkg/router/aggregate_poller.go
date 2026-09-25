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

// Defaults for background discovery polling. Not configurable yet.
const (
	// defaultAggregatePollInterval is the cooldown's interval while healthy.
	defaultAggregatePollInterval = 30 * time.Second
	defaultAggregateMinBackoff   = 5 * time.Second
	defaultAggregateMaxBackoff   = 5 * time.Minute

	// defaultAggregateDiscoveryTimeout bounds each discovery request, since a
	// hung request would otherwise stall that target's poll loop forever.
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

	// proxyTransport carries caller traffic with the caller's own credentials.
	// client is separate: it signs the router's own discovery polls.
	proxyTransport http.RoundTripper

	// cooldown is the only thing that paces run(): its steady interval is the
	// healthy re-poll cadence and its backoff is the post-failure retry
	// schedule. Written and read solely from run()'s goroutine.
	cooldown *cooldown

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]
}

func newAggregateTarget(cfg aggregateTargetConfig, client *http.Client, proxyTransport http.RoundTripper) (*aggregateTarget, error) {
	base, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("router: parsing %s url %q: %w", cfg.Name, cfg.URL, err)
	}
	// url.Parse accepts empty and relative URLs; fail startup instead of
	// polling a URL that can never work.
	if base.Scheme == "" || base.Host == "" {
		return nil, fmt.Errorf("router: %s url must be absolute (scheme and host required): url=%q", cfg.Name, cfg.URL)
	}
	// A trailing slash would turn "/apis" into "//apis".
	base.Path = strings.TrimRight(base.Path, "/")

	patterns, err := compileGroupPatterns(cfg.GroupPatterns)
	if err != nil {
		return nil, err
	}
	t := &aggregateTarget{
		name:           cfg.Name,
		base:           base,
		client:         client,
		proxyTransport: proxyTransport,
		patterns:       patterns,
		cooldown:       newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
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

// run polls until ctx is done, paced only by t.cooldown, and signals dirty
// when the discovered key set changes. Do not add a second ticker: it races
// the cooldown and masks the backoff schedule.
func (t *aggregateTarget) run(ctx context.Context, dirty chan<- struct{}) {
	timer := time.NewTimer(0) // fire immediately; don't wait an interval for the first attempt
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			t.poll(ctx, dirty)
			// poll always records an outcome on the cooldown; a non-positive
			// wait fires immediately.
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
		backend, err := newAggregateBackend(t.name, group, t.base, t.proxyTransport)
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
