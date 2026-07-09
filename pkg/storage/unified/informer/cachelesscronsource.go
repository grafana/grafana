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

// CronListFunc returns every object of one resource kind, read straight from the
// API. CachelessCronSource calls it once on start and again on every resync.
type CronListFunc func(ctx context.Context) ([]runtime.Object, error)

const (
	// defaultCronResync is the fallback re-list cadence for a non-positive interval.
	defaultCronResync = 5 * time.Minute
	// cronRetryInterval is how often the initial list is retried while it fails.
	cronRetryInterval = 5 * time.Second
)

// CachelessCronSource is the NATS-mode delta source for resources that gain nothing
// from live events. In NATS mode there is no apiserver watch to populate and
// resync a cache, so instead of watching, this source re-lists the resource from
// the API on a fixed schedule (cron-like) and delivers every listed object to the
// registered handlers as an add. It has no watch, no NATS subscription, and keeps
// no cache — it just re-lists.
//
// It is the explicit counterpart, for such resources, to the apiserver-backed
// SharedIndexInformer used when NATS is off: that informer watches, populates a
// cache and replays it on resync; this one simply re-lists. It suits idempotent,
// resync-driven handlers such as age-based historic-job cleanup, which
// re-evaluates every job's age on each pass regardless of whether it changed.
type CachelessCronSource struct {
	name   string
	resync time.Duration
	list   CronListFunc
	log    log.Logger

	// retryInterval is how often the initial list is retried while it fails;
	// defaults to cronRetryInterval.
	retryInterval time.Duration

	mu       sync.Mutex
	handlers []cache.ResourceEventHandler
}

// NewCachelessCronSource builds a cron-style, list-only source. name is used only for
// logging; resync is the re-list cadence (a non-positive value falls back to
// defaultCronResync); list reads the resource from the API.
func NewCachelessCronSource(name string, resync time.Duration, list CronListFunc) *CachelessCronSource {
	if resync <= 0 {
		resync = defaultCronResync
	}
	return &CachelessCronSource{
		name:          name,
		resync:        resync,
		list:          list,
		log:           log.New("provisioning.informer.cron"),
		retryInterval: cronRetryInterval,
	}
}

// AddEventHandler registers a handler to receive the listed objects, mirroring
// cache.SharedIndexInformer.AddEventHandler. Register all handlers before Run.
func (s *CachelessCronSource) AddEventHandler(handler cache.ResourceEventHandler) (cache.ResourceEventHandlerRegistration, error) {
	if handler == nil {
		return nil, fmt.Errorf("cron source %q: nil handler", s.name)
	}
	s.mu.Lock()
	s.handlers = append(s.handlers, handler)
	s.mu.Unlock()
	return cronRegistration{}, nil
}

// Run performs the initial list, then re-lists every resync until stopCh is
// closed. It blocks, so start it with `go source.Run(stopCh)`.
func (s *CachelessCronSource) Run(stopCh <-chan struct{}) {
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
func (s *CachelessCronSource) relist(ctx context.Context) error {
	objs, err := s.list(ctx)
	if err != nil {
		s.log.Warn("cron source: list failed", "name", s.name, "error", err)
		return err
	}
	s.log.Debug("cron source re-listed", "name", s.name, "count", len(objs))
	for _, obj := range objs {
		o := obj
		s.dispatch(func(h cache.ResourceEventHandler) { h.OnAdd(o, false) })
	}
	return nil
}

func (s *CachelessCronSource) dispatch(fn func(cache.ResourceEventHandler)) {
	s.mu.Lock()
	handlers := s.handlers
	s.mu.Unlock()
	for _, h := range handlers {
		fn(h)
	}
}

// cronRegistration is a no-op cache.ResourceEventHandlerRegistration: the cron
// source keeps no cache to sync, so it reports synced immediately. It exists only
// to satisfy the DeltaSource seam; callers do not WaitForCacheSync on it.
type cronRegistration struct{}

var _ cache.ResourceEventHandlerRegistration = cronRegistration{}

func (cronRegistration) HasSynced() bool { return true }

func (cronRegistration) HasSyncedChecker() cache.DoneChecker { return cronDoneChecker{} }

type cronDoneChecker struct{}

func (cronDoneChecker) Name() string          { return "cron-source" }
func (cronDoneChecker) Done() <-chan struct{} { return alwaysDone }

// alwaysDone is a pre-closed channel: the cron source has no cache-sync to wait on.
var alwaysDone = func() <-chan struct{} {
	ch := make(chan struct{})
	close(ch)
	return ch
}()
