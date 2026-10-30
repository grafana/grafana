package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"sync/atomic"
	"time"

	"github.com/sony/gobreaker/v2"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// handlerEntry is reconcile's record for one served group. backend is the one
// actually serving (not the latest Load result), so discovery stays consistent
// when a reload fails. lastKey lets reconcile skip unchanged groups. Owned by
// the reconcile goroutine, so it needs no lock.
type handlerEntry struct {
	backend Backend
	handler http.Handler
	lastKey string

	// breaker is replaced when the key changes, since the target may have
	// moved and its old trip state no longer applies. breakerView follows its
	// state; read that instead of breaker.State, which can change it.
	breaker     *groupBreaker
	breakerView *breakerView

	// watches scopes the watches served by this handler. reconcile ends it when
	// the handler is replaced or removed, so those watches move to the new one.
	watches    context.Context
	endWatches context.CancelFunc

	// loadedAt and watching are for the status page: when this handler was
	// loaded, and how many watches it is serving.
	loadedAt time.Time
	watching *atomic.Int64

	// use counts the requests in flight on a handler that must be destroyed
	// once it is retired; nil for one that holds nothing.
	use *handlerUse
}

func (r *GrafanaRouter) newHandlerEntry(b Backend, handler http.Handler, group string) *handlerEntry {
	watches, endWatches := context.WithCancel(context.Background())
	view := &breakerView{}
	onChange := func(group string, to gobreaker.State) {
		view.record(to)
		if r.onBreakerChange != nil {
			r.onBreakerChange(group, to)
		}
	}
	return &handlerEntry{
		backend: b, handler: handler, lastKey: b.Key(), breaker: newObservedGroupBreaker(group, onChange), breakerView: view,
		watches: watches, endWatches: endWatches,
		loadedAt: time.Now(), watching: &atomic.Int64{}, use: newHandlerUse(handler),
	}
}

// Run does an initial load, then reconciles on every coalesced wake from the
// loader until ctx is cancelled.
func (r *GrafanaRouter) Run(ctx context.Context) error {
	r.state.Store(&routerState{phase: starting})
	dirty, err := r.loader.Notify(ctx)
	if err != nil {
		return fmt.Errorf("router: notify: %w", err)
	}

	go func() {
		defer func() {
			if p := recover(); p != nil {
				r.state.Store(&routerState{phase: crashed, err: fmt.Errorf("panic: %v", p)})
			}
		}()

		// A failed reconcile is retried with backoff: nothing else guarantees
		// another wake, for example when the loader's first list fails and no
		// event follows. A wake from the loader still reconciles at once.
		retry := newCooldown(0, reconcileRetryMin, reconcileRetryMax)
		retryTimer := time.NewTimer(0)
		retryTimer.Stop()
		defer retryTimer.Stop()
		var retryC <-chan time.Time
		run := func() {
			err := r.reconcile(ctx)
			now := time.Now()
			if err == nil {
				retry.OnSuccess(now)
				retryTimer.Stop()
				retryC = nil
				return
			}
			retry.OnFailure(now)
			retryTimer.Reset(retry.Until(now))
			retryC = retryTimer.C
		}

		run()
		for {
			select {
			case <-ctx.Done():
				r.state.Store(&routerState{phase: stopped})
				return
			case _, ok := <-dirty:
				if !ok {
					// A closed channel is always ready and would busy-loop
					// reconcile; a nil channel is never selected.
					dirty = nil
					continue
				}
				run()
			case <-retryC:
				// The retry reads full state, so a wake already queued is covered.
				dirty = drainWake(dirty)
				run()
			}
		}
	}()
	return nil
}

// drainWake consumes a wake already queued on dirty, if any. It returns nil
// once dirty is closed, so the caller stops selecting on it.
func drainWake(dirty <-chan struct{}) <-chan struct{} {
	if dirty == nil {
		return nil
	}
	select {
	case _, ok := <-dirty:
		if !ok {
			return nil
		}
	default:
	}
	return dirty
}

// Backoff for retrying a failed reconcile.
const (
	reconcileRetryMin = time.Second
	reconcileRetryMax = time.Minute
)

// groupLoadRetryMax caps the backoff between loads of a backend that keeps
// failing. Loading a plugin backend builds an API server, so it is not
// retried on every reconcile.
const groupLoadRetryMax = 15 * time.Minute

// groupLoadFailure is a group's backend that failed to load: reconcile
// retries it only once backoff allows, and a new key is retried at once.
type groupLoadFailure struct {
	key     string
	err     error
	backoff *cooldown
	// failures counts the key's consecutive failed loads, since the first.
	failures int
	since    time.Time
}

// storeServing records a completed reconcile's outcome. Errors are logged
// here; Ready decides whether they affect readiness.
func (r *GrafanaRouter) storeServing(ctx context.Context, err error) {
	r.reconciles.Add(1)
	r.lastReconcile.Store(time.Now().UnixNano())
	if err != nil {
		r.reconcileErrors.Add(1)
		logging.FromContext(ctx).Error("router: reconcile completed with errors, serving last-known-good", "err", err)
	}
	r.state.Store(&routerState{phase: serving, err: err, served: len(r.served) > 0})
	if r.Ready(ctx) == nil {
		r.initialized.Store(true)
	}
}

// reconcile re-reads the full desired route set and converges served to it:
// rebuild changed/new groups, leave unchanged ones (key match) untouched, drop
// groups that disappeared, then publish a fresh snapshot. Level-triggered, so
// it is safe to run on any wake. It records its outcome, which Ready reports.
func (r *GrafanaRouter) reconcile(ctx context.Context) (err error) {
	start := time.Now()
	defer func() {
		r.reconcileDuration.observe(time.Since(start))
		r.storeServing(ctx, err)
	}()
	rawBackends, err := r.loader.Load(ctx)
	if err != nil {
		// Keep serving last-known-good; Run retries with backoff.
		return fmt.Errorf("router: load failed, keeping current routes: %w", err)
	}

	// The loader returns the same routes on every reconcile, so log each
	// warning when it first appears, not on every retry.
	warnings := make(map[string]struct{}, len(r.warnings))
	defer func() { r.warnings = warnings }()
	warn := func(msg string, args ...any) {
		id := fmt.Sprint(msg, args)
		warnings[id] = struct{}{}
		if _, logged := r.warnings[id]; !logged {
			logging.FromContext(ctx).Warn(msg, args...)
		}
	}

	var errs []error
	type retiredEntry struct {
		group string
		entry *handlerEntry
	}
	var retired []retiredEntry
	seen := make(map[string]struct{}, len(rawBackends))
	for _, b := range rawBackends {
		group := b.Group().Name
		if group == discoveryGroup {
			// The router serves this group itself, ahead of group dispatch, so
			// a backend for it could never be reached. The remote sources drop
			// it at discovery; this guards loaders that don't.
			warn("router: skipping backend for the reserved discovery group", "source", b.Source(), "key", b.Key())
			continue
		}
		if !utils.IsAPIGroup(group) {
			// Requests are dispatched by apiGroup, which reads no group from an
			// invalid name, so such a backend could be advertised but never
			// reached. Aggregate discovery, for one, reports whatever groups a
			// target lists.
			warn("router: skipping backend with an invalid group name", "group", group, "source", b.Source(), "key", b.Key())
			continue
		}
		if _, dup := seen[group]; dup {
			// One backend owns all versions of a group. A duplicate is a config
			// error; the last one wins rather than crashing the router.
			warn("router: duplicate group in route set, overwriting", "group", group)
		}
		seen[group] = struct{}{}

		e, ok := r.served[group]
		if ok && e.lastKey == b.Key() {
			delete(r.loadFailures, group)
			continue // unchanged: keep the live Backend (and its pool)
		}

		handler, err := r.loadGroup(ctx, group, b)
		if err != nil {
			// Keep last-known-good for this group. lastKey is not advanced, so
			// a later reconcile loads it again.
			errs = append(errs, err)
			continue
		}

		if !ok {
			// New group: create the entry, starting with a fresh, closed breaker.
			r.served[group] = r.newHandlerEntry(b, handler, group)
			continue
		}
		// Changed: replace the entry. Connection pools survive because each
		// source owns its transports and connections, not the backend; the
		// breaker is reset (see handlerEntry).
		retired = append(retired, retiredEntry{group, e})
		r.served[group] = r.newHandlerEntry(b, handler, group)
	}

	for group := range r.loadFailures {
		if _, ok := seen[group]; !ok {
			delete(r.loadFailures, group)
		}
	}
	var removed []string
	for group, e := range r.served {
		if _, ok := seen[group]; !ok {
			retired = append(retired, retiredEntry{group, e})
			delete(r.served, group)
			removed = append(removed, group)
		}
	}

	r.publishLoadFailures()
	r.publish(ctx)
	if len(removed) > 0 && r.onGroupsRemoved != nil {
		r.onGroupsRemoved(removed)
	}
	// End retired watches only after publishing, so clients that re-watch
	// reach the new backend. Then destroy what the retired handlers hold,
	// once their requests finish.
	for _, retired := range retired {
		if retired.entry.endWatches != nil {
			retired.entry.endWatches()
		}
		destroyWhenDrained(ctx, retired.group, retired.entry)
	}
	return errors.Join(errs...)
}

// publishLoadFailures publishes the groups whose backend is failing to load,
// for the status page.
func (r *GrafanaRouter) publishLoadFailures() {
	docs := make([]loadFailureDoc, 0, len(r.loadFailures))
	for group, failure := range r.loadFailures {
		_, serving := r.served[group]
		docs = append(docs, loadFailureDoc{
			Group:    group,
			Key:      failure.key,
			Failures: failure.failures,
			Since:    failure.since.UTC(),
			RetryAt:  failure.backoff.next.UTC(),
			Serving:  serving,
		})
	}
	sort.Slice(docs, func(i, j int) bool { return docs[i].Group < docs[j].Group })
	r.loadFailureDocs.Store(&docs)
}

// loadGroup loads b's handler for group. A backend that failed to load is
// retried only once its backoff passes; until then its error is reported
// again, so Ready and the reconcile log don't change.
func (r *GrafanaRouter) loadGroup(ctx context.Context, group string, b Backend) (http.Handler, error) {
	now := time.Now()
	failure := r.loadFailures[group]
	if failure != nil && failure.key == b.Key() && failure.backoff.Until(now) > 0 {
		return nil, failure.err
	}
	handler, err := loadBackend(ctx, b)
	if err == nil {
		delete(r.loadFailures, group)
		return handler, nil
	}
	if failure == nil || failure.key != b.Key() {
		failure = &groupLoadFailure{key: b.Key(), backoff: newCooldown(0, reconcileRetryMin, groupLoadRetryMax), since: now}
		if r.loadFailures == nil {
			r.loadFailures = map[string]*groupLoadFailure{}
		}
		r.loadFailures[group] = failure
	}
	failure.backoff.OnFailure(now)
	failure.failures++
	failure.err = fmt.Errorf("router: backend load failed for group %q, keeping current route: %w", group, err)
	return nil, failure.err
}

// loadBackend turns a panic in one backend's Load into that group's error, so
// a bad backend (such as a plugin with an invalid manifest) cannot stop the
// reconcile loop for every other group.
func loadBackend(ctx context.Context, b Backend) (handler http.Handler, err error) {
	defer func() {
		if p := recover(); p != nil {
			handler, err = nil, fmt.Errorf("panic: %v", p)
		}
	}()
	return b.Load(ctx)
}

// publish atomically stores the serving snapshot and the synthesized root
// discovery documents, all built from r.served.
func (r *GrafanaRouter) publish(ctx context.Context) {
	snap := make(map[string]servingEntry, len(r.served))
	backends := make([]Backend, 0, len(r.served))
	for group, e := range r.served {
		entry := servingEntry{handler: e.handler, key: e.lastKey, breaker: e.breaker, breakerView: e.breakerView, watches: e.watches, loadedAt: e.loadedAt, watching: e.watching, use: e.use}
		entry.breakerScope = groupBreakerScope(e.handler)
		if e.breaker == nil {
			entry.breakerScope = breakerScopeNone
		}
		if e.backend != nil {
			entry.group = e.backend.Group()
			entry.source = e.backend.Source()
			backends = append(backends, e.backend)
			if provider, ok := e.backend.(DiscoveryProvider); ok {
				if d, ok := provider.Discovery(); ok {
					entry.discovery = &d
				}
			}
			if provider, ok := e.backend.(PluginStatusProvider); ok {
				if plugin, ok := provider.PluginStatus(); ok {
					entry.plugin = &plugin
				}
			}
			_, entry.hasManifest = backendManifest(e.backend)
			_, entry.callerScoped = e.backend.(CallerScopedDiscovery)
		}
		snap[group] = entry
	}
	r.snapshot.Store(&snap)
	r.discoveryCache.retain(snap)
	r.retainOpenAPIDocs(snap)

	r.publishRootDocs(ctx, backends)
	r.publishManifestDocs(ctx, backends)
}
