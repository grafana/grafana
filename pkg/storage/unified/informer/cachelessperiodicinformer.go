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

// PeriodicListFunc returns every object of one resource kind, read straight from
// the API. CachelessPeriodicInformer calls it once on start and again on
// every resync.
type PeriodicListFunc func(ctx context.Context) ([]runtime.Object, error)

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

	// metrics records re-list success/failure for staleness dashboards; nil disables.
	metrics Metrics

	// retryInterval is how often the initial list is retried while it fails;
	// defaults to periodicRetryInterval.
	retryInterval time.Duration

	mu       sync.Mutex
	handlers []cache.ResourceEventHandler
}

// NewCachelessPeriodicInformer builds a list-only source. name is used both for
// logging and as the resource label on its re-list metrics; resync is the re-list
// cadence (a non-positive value falls back to defaultPeriodicResync); list reads
// the resource from the API. metrics records re-list success/failure; pass nil to
// disable.
func NewCachelessPeriodicInformer(name string, resync time.Duration, list PeriodicListFunc, metrics Metrics) *CachelessPeriodicInformer {
	if resync <= 0 {
		resync = defaultPeriodicResync
	}
	return &CachelessPeriodicInformer{
		name:          name,
		resync:        resync,
		list:          list,
		log:           log.New("provisioning.informer.periodiclister"),
		metrics:       metrics,
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
	// resync interval.
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
func (s *CachelessPeriodicInformer) relist(ctx context.Context) error {
	objs, err := s.list(ctx)
	if err != nil {
		s.log.Warn("periodic lister: list failed", "name", s.name, "error", err)
		if s.metrics != nil {
			s.metrics.ObserveRelistError(s.name)
		}
		return err
	}
	s.log.Info("periodic lister re-listed", "name", s.name, "count", len(objs))
	for _, obj := range objs {
		o := obj
		s.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(o, false) })
	}
	// This source only ever re-lists (no live stream), so every pass is a periodic
	// re-list. Per-object events are intentionally not recorded: it re-delivers the
	// whole set each pass, so counting them would not mean "changes". The object
	// count is recorded as the re-list size instead.
	if s.metrics != nil {
		s.metrics.ObserveRelist(s.name, TriggerPeriodic, len(objs))
	}
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
