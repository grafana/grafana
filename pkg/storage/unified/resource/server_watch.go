package resource

import (
	"context"
	"sync"
)

// Only KV opts into seeded startup. SQL's independently polled collections do
// not satisfy the global ordering required by these resume boundaries.
type seededWatchBackend interface {
	// watchWriteEventsWithSeed calls captured once the bus captures every later
	// write, before it reads the seed. floors, if set, take the writes the
	// stream loses later.
	watchWriteEventsWithSeed(ctx context.Context, floors *raisedFloors, captured func()) (watchSeed, <-chan *WrittenEvent, error)
}

// ResumeFloorWatchBackend reports, per collection, the RV from which its watch
// stream has every write, so resuming below it gets 410 instead of silently
// missing writes from before the stream started.
type ResumeFloorWatchBackend interface {
	WatchResumeFloorsEnabled() bool
	// A collection without a floor had no writes before the stream started.
	// floors takes the writes the stream lost later. captured is called once
	// the bus captures every later write.
	WatchWriteEventsWithResumeFloors(ctx context.Context, floors ResumeFloors, captured func()) (map[GroupResource]int64, <-chan *WrittenEvent, error)
}

// ResumeFloors take the writes a watch stream lost, so resumes that cannot
// replay them get 410 even if no watch was open. Their methods must not block.
type ResumeFloors interface {
	// Raise rejects resumes from before rv in the collection.
	Raise(gr GroupResource, rv int64)
	// Hold rejects every resume until Release, while the backend does not know
	// yet which writes the stream lost.
	Hold()
	Release()
}

type resumeFloorWatchBackend struct {
	backend ResumeFloorWatchBackend
}

func (b resumeFloorWatchBackend) watchWriteEventsWithSeed(ctx context.Context, raised *raisedFloors, captured func()) (watchSeed, <-chan *WrittenEvent, error) {
	floors, events, err := b.backend.WatchWriteEventsWithResumeFloors(ctx, raised, captured)
	if err != nil {
		return watchSeed{}, nil, err
	}
	seed := watchSeed{collectionFloors: floors}
	for _, rv := range floors {
		seed.highestRV = max(seed.highestRV, rv)
	}
	return seed, events, nil
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
	raised := newRaisedFloors()
	out := make(chan *WrittenEvent, producerChanSize)
	startup := &watchStartup{stopped: make(chan struct{})}
	var metrics *BroadcasterMetrics
	if s.storageMetrics != nil {
		metrics = s.storageMetrics.Broadcaster
	}

	var capture sync.WaitGroup
	initialize := func(ctx context.Context) (cacheSeed[*WrittenEvent], error) {
		seed, events, err := backend.watchWriteEventsWithSeed(ctx, raised, func() {
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
			items: seed.events, initialCacheFloor: seed.initialCacheFloor, collectionFloors: seed.collectionFloors,
		}, nil
	}

	// Construction stays asynchronous even if NATS has not entered Run yet.
	b := newBroadcasterWithSizes(s.ctx, out, watchChanSize, defaultOverflowCap, metrics, func(e *WrittenEvent) string {
		return e.Key.Resource
	}, &seededCacheConfig[*WrittenEvent]{
		identity:   writtenEventIdentity,
		initialize: initialize,
		raised:     raised,
	})
	startup.broadcaster = b
	s.broadcaster, s.watchStartup = b, startup
	go func() {
		<-b.terminated
		capture.Wait()
		close(startup.stopped)
	}()
}
