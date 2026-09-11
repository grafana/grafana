package router

import (
	"context"
	"net/http"
	"net/url"
	"regexp"
	"sync/atomic"
	"time"

	"log/slog"
)

// Defaults for aggregate-target polling. Not exposed as ini keys in this
// iteration -- see the plan's Global Constraints for why -- but isolated
// here so promoting them to config later touches one place.
const (
	defaultAggregatePollInterval = 30 * time.Second
	defaultAggregateMinBackoff   = 5 * time.Second
	defaultAggregateMaxBackoff   = 5 * time.Minute
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

	pollInterval time.Duration
	cooldown     *cooldown

	snapshot atomic.Pointer[[]Backend]
	lastKeys atomic.Pointer[map[string]struct{}]
}

func newAggregateTarget(cfg aggregateTargetConfig, client *http.Client) (*aggregateTarget, error) {
	base, err := url.Parse(cfg.URL)
	if err != nil {
		return nil, err
	}
	patterns, err := compileGroupPatterns(cfg.GroupPatterns)
	if err != nil {
		return nil, err
	}
	t := &aggregateTarget{
		name:         cfg.Name,
		base:         base,
		client:       client,
		patterns:     patterns,
		pollInterval: defaultAggregatePollInterval,
		cooldown:     newCooldown(defaultAggregatePollInterval, defaultAggregateMinBackoff, defaultAggregateMaxBackoff),
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

// run polls until ctx is done, respecting t.cooldown between attempts.
// Signals dirty (non-blocking, coalescing -- matches cloudLoader.dirty's
// existing contract) only when the discovered key set actually changed, so
// a downed or unchanged target never triggers a needless reconcile.
func (t *aggregateTarget) run(ctx context.Context, dirty chan<- struct{}) {
	ticker := time.NewTicker(t.pollInterval)
	defer ticker.Stop()

	t.poll(ctx, dirty) // first attempt immediately, don't wait a full interval
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			t.poll(ctx, dirty)
		}
	}
}

func (t *aggregateTarget) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()
	if !t.cooldown.Ready(now) {
		return
	}

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
