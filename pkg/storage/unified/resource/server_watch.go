package resource

import (
	"context"
	"sync"
)

// Only KV opts into seeded startup. SQL's independently polled collections do
// not satisfy the global ordering required by these resume boundaries.
type seededWatchBackend interface {
	watchWriteEventsWithSeed(context.Context) (watchSeed, <-chan *WrittenEvent, error)
}

type watchStartup struct {
	stopped     chan struct{}
	broadcaster *broadcaster[*WrittenEvent]

	mu          sync.Mutex
	captureDone <-chan struct{}
}

func (w *watchStartup) setCaptureDone(done <-chan struct{}) {
	w.mu.Lock()
	w.captureDone = done
	w.mu.Unlock()
}

func (w *watchStartup) waitForCapture() {
	w.mu.Lock()
	done := w.captureDone
	w.mu.Unlock()
	if done != nil {
		<-done
	}
}

func (s *server) initSeededWatcher(backend seededWatchBackend) {
	out := make(chan *WrittenEvent, producerChanSize)
	startup := &watchStartup{stopped: make(chan struct{})}
	var metrics *BroadcasterMetrics
	if s.storageMetrics != nil {
		metrics = s.storageMetrics.Broadcaster
	}

	initialize := func(ctx context.Context) (cacheSeed[*WrittenEvent], error) {
		seed, events, err := backend.watchWriteEventsWithSeed(ctx)
		if err != nil {
			s.log.Error("failed to initialize watch cache", "error", err)
			return cacheSeed[*WrittenEvent]{}, err
		}
		s.mostRecentRV.Store(seed.highestRV)
		captureDone := make(chan struct{})
		startup.setCaptureDone(captureDone)
		go func() {
			defer close(captureDone)
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
		}()
		return cacheSeed[*WrittenEvent]{
			items: seed.events, initialCacheFloor: seed.initialCacheFloor,
		}, nil
	}

	// Construction stays asynchronous even if NATS has not entered Run yet.
	b := newBroadcasterWithSizes(s.ctx, out, watchChanSize, defaultOverflowCap, metrics, func(e *WrittenEvent) string {
		return e.Key.Resource
	}, writtenEventIdentity, initialize)
	startup.broadcaster = b
	s.broadcaster, s.watchStartup = b, startup
	go func() {
		<-b.terminated
		startup.waitForCapture()
		close(startup.stopped)
	}()
}
