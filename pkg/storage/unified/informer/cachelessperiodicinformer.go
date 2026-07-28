package informer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/log"
)

// PeriodicListFunc delivers every object of one resource kind, read straight
// from the API, to emit. CachelessPeriodicInformer calls it once on start and
// again on every resync.
//
// It streams rather than returning a slice because the resources this source
// serves can be numerous - a re-list that materialised all of them would hold
// the whole set in memory for the length of the pass, to no purpose: this
// source keeps no cache and only forwards each object once.
//
// Streaming makes a pass divisible, so the handlers must be too: a list that
// fails partway has already emitted a prefix of the resource, and the returned
// error does not take those objects back. Handlers registered here must
// therefore act on one object at a time and be safe to re-run - a handler that
// needs a complete set (a count, or "delete whatever this pass did not
// mention") cannot be driven by this source, because it would read a prefix as
// the whole. That is not a new constraint: every pass re-delivers every object
// as an add, so a handler that could not tolerate repeats never fit here
// either.
type PeriodicListFunc func(ctx context.Context, emit func(runtime.Object)) error

const (
	// defaultPeriodicResync is the fallback re-list cadence for a non-positive interval.
	defaultPeriodicResync = 5 * time.Minute
	// periodicRetryInterval is how often the initial list is retried while it fails.
	periodicRetryInterval = 5 * time.Second
)

// CachelessPeriodicInformer is the NATS-mode delta source for resources
// that gain nothing from live events. In NATS mode there is no apiserver watch to
// populate and resync a cache, so instead of watching, this source re-lists the
// resource from the API on a fixed schedule and delivers every listed object to
// the registered handlers as an add. It has no watch, no NATS subscription, and
// keeps no cache — it just re-lists.
//
// It is the explicit counterpart, for such resources, to the apiserver-backed
// SharedIndexInformer used when NATS is off: that informer watches, populates a
// cache and replays it on resync; this one simply re-lists. It suits idempotent,
// resync-driven handlers such as age-based historic-job cleanup, which
// re-evaluates every job's age on each pass regardless of whether it changed.
type CachelessPeriodicInformer struct {
	name   string
	resync time.Duration
	list   PeriodicListFunc
	log    log.Logger

	// retryInterval is how often the initial list is retried while it fails;
	// defaults to periodicRetryInterval.
	retryInterval time.Duration

	mu       sync.Mutex
	handlers []cache.ResourceEventHandler
}

// NewCachelessPeriodicInformer builds a list-only source. name is used only
// for logging; resync is the re-list cadence (a non-positive value falls back to
// defaultPeriodicResync); list reads the resource from the API.
func NewCachelessPeriodicInformer(name string, resync time.Duration, list PeriodicListFunc) *CachelessPeriodicInformer {
	if resync <= 0 {
		resync = defaultPeriodicResync
	}
	return &CachelessPeriodicInformer{
		name:          name,
		resync:        resync,
		list:          list,
		log:           log.New("provisioning.informer.periodiclister"),
		retryInterval: periodicRetryInterval,
	}
}

// AddEventHandler registers a handler to receive the listed objects, mirroring
// cache.SharedIndexInformer.AddEventHandler. Register all handlers before Run.
func (s *CachelessPeriodicInformer) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	if handler == nil {
		return nil, fmt.Errorf("periodic lister %q: nil handler", s.name)
	}
	s.mu.Lock()
	s.handlers = append(s.handlers, handler)
	s.mu.Unlock()
	return periodicRegistration{}, nil
}

// Run performs the initial list, then re-lists every resync until stopCh is
// closed. It blocks, so start it with `go informer.Run(stopCh)`.
func (s *CachelessPeriodicInformer) Run(stopCh <-chan struct{}) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go func() {
		select {
		case <-stopCh:
			cancel()
		case <-ctx.Done():
		}
	}()

	// Deliver an initial pass promptly, retrying until the first list succeeds so
	// a transient API error at startup does not defer the first cleanup by a whole
	// resync interval. A list that keeps failing at the same point re-delivers the
	// prefix it reached on every retry; that costs the handlers repeated no-op
	// work, not correctness, because they are idempotent.
	for {
		if err := s.relist(ctx); err == nil {
			break
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(s.retryInterval):
		}
	}

	ticker := time.NewTicker(s.resync)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Error already logged in relist; the next tick retries.
			_ = s.relist(ctx)
		}
	}
}

// relist reads the full set from the API and delivers every object as an add. The
// handlers are idempotent, so re-delivering unchanged objects each pass is
// intended: it is what re-triggers resync-driven work such as age-based cleanup.
//
// Objects are dispatched as they arrive, so a list that fails partway through
// has already delivered what it read. That is the same idempotence at work: the
// handlers act per object and the next pass re-reads everything, so partial
// progress is worth more than discarding it.
func (s *CachelessPeriodicInformer) relist(ctx context.Context) error {
	count := 0
	err := s.list(ctx, func(obj runtime.Object) {
		count++
		s.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(obj, false) })
	})
	if err != nil {
		s.log.Warn("periodic lister: list failed", "name", s.name, "error", err, "delivered", count)
		return err
	}
	s.log.Debug("periodic lister re-listed", "name", s.name, "count", count)
	return nil
}

func (s *CachelessPeriodicInformer) dispatch(fn func(cache.ResourceEventHandler)) {
	s.mu.Lock()
	handlers := s.handlers
	s.mu.Unlock()
	for _, h := range handlers {
		fn(h)
	}
}

// periodicRegistration is a no-op cache.ResourceEventHandlerRegistration: the
// periodic lister keeps no cache to sync, so it reports synced immediately. It
// exists only to satisfy the DeltaSource seam; callers do not WaitForCacheSync on it.
type periodicRegistration struct{}

var _ cache.ResourceEventHandlerRegistration = periodicRegistration{}

func (periodicRegistration) HasSynced() bool { return true }

func (periodicRegistration) HasSyncedChecker() cache.DoneChecker { return periodicDoneChecker{} }

type periodicDoneChecker struct{}

func (periodicDoneChecker) Name() string          { return "periodic-lister" }
func (periodicDoneChecker) Done() <-chan struct{} { return alwaysDone }

// alwaysDone is a pre-closed channel: the periodic lister has no cache-sync to wait on.
var alwaysDone = func() <-chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}()
