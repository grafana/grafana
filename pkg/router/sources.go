package router

import (
	"context"
	"net/http"
	"sync/atomic"
	"time"

	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/logging"
)

// Route sources, as reported by Backend.Source.
const (
	sourceSingleTenant  = "single-tenant"
	sourcePluginsURL    = "plugins_url"
	sourceCoreURL       = "core_url"
	sourceLocalPlugin   = "local-plugin"
	sourceDev           = "dev"
	aggregateSourceName = "aggregate:"
)

func aggregateSource(target string) string { return aggregateSourceName + target }

// sourceStatus is how a route source's loads or polls are going.
type sourceStatus struct {
	Source string `json:"source"`
	// LastSuccess is when the source last loaded successfully; zero if never.
	LastSuccess time.Time `json:"lastSuccess"`
	// Successes and Failures count attempts since the router started.
	Successes uint64 `json:"successes"`
	Failures  uint64 `json:"failures"`
	// Skipped is the number of backends the latest successful load skipped.
	Skipped int `json:"skipped"`
}

// shadowedGroup is a group that one source offered but a higher-priority
// source serves instead. The single-tenant fallback is never reported, since
// every other source is meant to override it.
type shadowedGroup struct {
	Group  string `json:"group"`
	Source string `json:"source"`
	By     string `json:"servedBy"`
}

// loaderStatus is an optional RoutesLoader interface for loaders that report
// on their sources.
type loaderStatus interface {
	sourceStatuses() []sourceStatus
	shadowedGroups() []shadowedGroup
	// counters reports the loader's own counters. The set of counters must
	// not change once the loader is built, since their metrics are described
	// from it.
	counters() []loaderCounter
}

// loaderCounter is a loader's own counter, by result, such as the
// single-tenant fallback's stack lookups. The router reports it as the
// counter grafana_router_<Metric>{result}, and, when Status is set, under
// that field of the status page.
type loaderCounter struct {
	Metric   string
	Help     string
	Status   string
	ByResult map[string]uint64
}

// unregisteredGroupLoader is an optional RoutesLoader interface for a loader
// that serves the groups no backend does, in the standalone router.
type unregisteredGroupLoader interface {
	// UnregisteredGroupHandler returns the handler, or nil for none. It
	// answers root discovery for the caller too, and its answer replaces the
	// defaults of caller-scoped backends.
	UnregisteredGroupHandler() http.Handler
}

// pollStatus records the outcome of a source's loads. Safe for concurrent use.
type pollStatus struct {
	lastSuccess atomic.Int64 // Unix nanoseconds; zero if never
	successes   atomic.Uint64
	failures    atomic.Uint64
	skipped     atomic.Int64
}

// recordSuccess records a successful attempt, and reports whether it was the
// source's first attempt (see recordFailure). Call it only once the attempt's
// snapshot is stored: the cloud loader serves a source once it has polled,
// and must then see the source's groups.
func (p *pollStatus) recordSuccess(now time.Time) (first bool) {
	p.lastSuccess.Store(now.UnixNano())
	return p.successes.Add(1) == 1 && p.failures.Load() == 0
}

// recordFailure records a failed attempt, and reports whether it was the
// source's first attempt: the first attempt ends the cloud loader's pending
// state, failed or not, so its poll loop wakes the router for it.
func (p *pollStatus) recordFailure() (first bool) {
	return p.failures.Add(1) == 1 && p.successes.Load() == 0
}

// wake asks the router to reconcile, coalescing with a wake already pending.
func wake(dirty chan<- struct{}) {
	select {
	case dirty <- struct{}{}:
	default:
	}
}

// recordSkipped records how many backends the latest load skipped.
func (p *pollStatus) recordSkipped(skipped int) {
	p.skipped.Store(int64(skipped))
}

func (p *pollStatus) status(source string) sourceStatus {
	s := sourceStatus{Source: source, Successes: p.successes.Load(), Failures: p.failures.Load(), Skipped: int(p.skipped.Load())}
	if ns := p.lastSuccess.Load(); ns != 0 {
		s.LastSuccess = time.Unix(0, ns).UTC()
	}
	return s
}

// polledSource is a route source that polls for its backends: an aggregate
// target, a plugin manifests source or the single-tenant fallback. Its poll
// loop is paced only by its cooldown, and a failed poll keeps the backends
// the last successful one found.
type polledSource struct {
	// source names the source in sourceStatus.
	source  string
	fetcher sourceFetcher
	// fallback marks a source that every other one is meant to override: a
	// group it loses is not shadowed, and its poll error fails a load that
	// finds no group.
	fallback bool

	// cooldown is written and read only by the poll loop.
	cooldown *cooldown
	status   pollStatus
	// snapshot is written only by the poll loop; nil until the first poll.
	snapshot atomic.Pointer[polledSnapshot]
}

// sourceFetcher is what a polledSource polls.
type sourceFetcher interface {
	// fetch returns every backend the source serves, and how many it skipped.
	fetch(context.Context) (backends []Backend, skipped int, err error)
}

// sourceCloser is a sourceFetcher that holds resources, such as connections,
// until the loader stops.
type sourceCloser interface {
	close()
}

// polledSnapshot is the outcome of a source's latest poll.
type polledSnapshot struct {
	backends []Backend
	// err is set when the latest poll failed; backends are then the last
	// ones found.
	err error
}

// current returns the latest poll's outcome. Safe to call from any goroutine.
func (p *polledSource) current() polledSnapshot {
	if s := p.snapshot.Load(); s != nil {
		return *s
	}
	return polledSnapshot{}
}

// Backends returns the last backends found. Safe to call from any goroutine.
func (p *polledSource) Backends() []Backend {
	return p.current().backends
}

// run polls until ctx is done, paced only by p.cooldown, and wakes dirty when
// the outcome can change what a load returns. Do not add a second ticker: it
// races the cooldown and masks the backoff schedule.
func (p *polledSource) run(ctx context.Context, dirty chan<- struct{}) {
	timer := time.NewTimer(0) // fire immediately; don't wait an interval for the first attempt
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			p.poll(ctx, dirty)
			// poll always records an outcome on the cooldown; a non-positive
			// wait fires immediately.
			timer.Reset(p.cooldown.Until(time.Now()))
		}
	}
}

// poll runs one attempt and records its outcome on the cooldown, which
// schedules the next one. It wakes dirty on the source's first attempt, failed
// or not, since that ends the cloud loader's wait for it, on a success after a
// failure, and when the backends' keys change.
func (p *polledSource) poll(ctx context.Context, dirty chan<- struct{}) {
	now := time.Now()
	prev := p.current()

	backends, skipped, err := p.fetcher.fetch(ctx)
	if err != nil {
		p.cooldown.OnFailure(now)
		logging.FromContext(ctx).Warn("router: source poll failed, keeping its last backends and backing off", "source", p.source, "err", err)
		p.snapshot.Store(&polledSnapshot{backends: prev.backends, err: err})
		if p.status.recordFailure() {
			wake(dirty)
		}
		return
	}
	p.cooldown.OnSuccess(now)
	// Store before recording the success: a load that sees the poll must see
	// its backends.
	p.snapshot.Store(&polledSnapshot{backends: backends})
	p.status.recordSkipped(skipped)
	first := p.status.recordSuccess(now)

	if first || prev.err != nil || !sameKeySet(backendKeys(prev.backends), backendKeys(backends)) {
		wake(dirty)
	}
}

// teardown releases what the source holds, once its poll loop has stopped.
func (p *polledSource) teardown() {
	if c, ok := p.fetcher.(sourceCloser); ok {
		c.close()
	}
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

var (
	_ Backend              = (*wrappedBackend)(nil)
	_ DiscoveryProvider    = (*wrappedBackend)(nil)
	_ ManifestProvider     = (*wrappedBackend)(nil)
	_ PluginStatusProvider = (*wrappedBackend)(nil)
)

// wrappedBackend wraps the handler a Backend loads, and forwards the optional
// interfaces that the embedded Backend interface does not promote. It does
// not forward CallerScopedDiscovery, a marker it can't report conditionally,
// so it must not wrap a caller-scoped backend.
type wrappedBackend struct {
	Backend
	wrap func(http.Handler) http.Handler
}

func (b *wrappedBackend) Load(ctx context.Context) (http.Handler, error) {
	next, err := b.Backend.Load(ctx)
	if err != nil {
		return nil, err
	}
	return b.wrap(next), nil
}

// Discovery implements [DiscoveryProvider].
func (b *wrappedBackend) Discovery() (apidiscoveryv2.APIGroupDiscovery, bool) {
	if p, ok := b.Backend.(DiscoveryProvider); ok {
		return p.Discovery()
	}
	return apidiscoveryv2.APIGroupDiscovery{}, false
}

// Manifest implements [ManifestProvider].
func (b *wrappedBackend) Manifest() (*app.ManifestData, bool) {
	if p, ok := b.Backend.(ManifestProvider); ok {
		return p.Manifest()
	}
	return nil, false
}

// PluginStatus implements [PluginStatusProvider].
func (b *wrappedBackend) PluginStatus() (PluginStatus, bool) {
	if p, ok := b.Backend.(PluginStatusProvider); ok {
		return p.PluginStatus()
	}
	return PluginStatus{}, false
}
