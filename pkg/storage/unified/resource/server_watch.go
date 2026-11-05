package resource

import (
	"context"
	"sync"
)

// Only KV opts into seeded startup. SQL's independently polled collections do
// not satisfy the global ordering required by these resume boundaries.
type seededWatchBackend interface {
	// watchWriteEventsWithSeed calls captured once the bus captures every later
	// write, before it reads the seed.
	watchWriteEventsWithSeed(ctx context.Context, captured func()) (watchSeed, <-chan *WrittenEvent, error)
}

type watchStartup struct {
	stopped     chan struct{}
	broadcaster *broadcaster[*WrittenEvent]

	mu sync.Mutex
	// expiry is the watch expiry generation when capture last started.
	expiry <-chan struct{}
}

func (w *watchStartup) setExpiry(expiry <-chan struct{}) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.expiry = expiry
}

func (w *watchStartup) expiryAtCapture() <-chan struct{} {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.expiry
}

func (s *server) initSeededWatcher(backend seededWatchBackend) {
	out := make(chan *WrittenEvent, producerChanSize)
	startup := &watchStartup{stopped: make(chan struct{})}
	var metrics *BroadcasterMetrics
	if s.storageMetrics != nil {
		metrics = s.storageMetrics.Broadcaster
	}

	var capture sync.WaitGroup
	initialize := func(ctx context.Context) (cacheSeed[*WrittenEvent], error) {
		seed, events, err := backend.watchWriteEventsWithSeed(ctx, func() {
			startup.setExpiry(s.watchExpiry.WatchInvalidation())
		})
		if err != nil {
			if ctx.Err() == nil {
				s.log.Error("failed to initialize watch cache", "error", err)
			}
			return cacheSeed[*WrittenEvent]{}, err
		}
		s.mostRecentRV.Store(seed.highestRV)
		capture.Go(func() {
			defer close(out)
			defer func() {
				for range events {
				}
			}()
			for {
				select {
				case <-ctx.Done():
					return
				case event, ok := <-events:
					if !ok {
						return
					}
					if event == nil || event.PreviousRV < 0 {
						continue
					}
					s.mostRecentRV.Store(event.ResourceVersion)
					select {
					case out <- event:
					case <-ctx.Done():
						return
					}
				}
			}
		})
		return cacheSeed[*WrittenEvent]{
			items: seed.events, initialCacheFloor: seed.initialCacheFloor,
		}, nil
	}

	// Construction stays asynchronous even if NATS has not entered Run yet.
	b := newBroadcasterWithSizes(s.ctx, out, watchChanSize, defaultOverflowCap, metrics, func(e *WrittenEvent) string {
		return e.Key.Resource
	}, &seededCacheConfig[*WrittenEvent]{
		identity:   writtenEventIdentity,
		initialize: initialize,
	})
	startup.broadcaster = b
	s.broadcaster, s.watchStartup = b, startup
	go func() {
		<-b.terminated
		capture.Wait()
		close(startup.stopped)
	}()
}
