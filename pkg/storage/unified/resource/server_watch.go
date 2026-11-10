package resource

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"

	"github.com/grafana/grafana-app-sdk/logging"
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

// UnknownGaps holds every resume after a bus drop or reconnect until the
// floors are raised above the writes the stream may have lost. raise reads the
// backend's current boundary, which is above any write lost before the gap was
// reported, and applies it to the floors.
type UnknownGaps struct {
	floors ResumeFloors
	raise  func(context.Context) error
	log    logging.Logger
	signal chan struct{}

	mu        sync.Mutex
	captured  bool
	reported  int64
	abandoned bool
}

func NewUnknownGaps(floors ResumeFloors, raise func(context.Context) error, log logging.Logger) *UnknownGaps {
	return &UnknownGaps{floors: floors, raise: raise, log: log, signal: make(chan struct{}, 1)}
}

// Capture starts counting gaps, then calls captured if set. Earlier ones, such
// as the one a retried first subscription reports, are covered by the boundary
// the stream starts from, which is read after capture. Gaps reported from
// captured are counted.
func (g *UnknownGaps) Capture(captured func()) {
	g.mu.Lock()
	g.captured = true
	g.mu.Unlock()
	if captured != nil {
		captured()
	}
}

// Report holds every resume. It must be called before the watches expire: a
// resume admitted after the expiry takes the new generation, so only a hold
// placed before it can reject the resume. It does not block.
func (g *UnknownGaps) Report() {
	g.mu.Lock()
	if !g.captured || g.abandoned {
		g.mu.Unlock()
		return
	}
	g.reported++
	g.floors.Hold()
	g.mu.Unlock()
	select {
	case g.signal <- struct{}{}:
	default:
	}
}

func (g *UnknownGaps) count() int64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.reported
}

// Abandon releases the hold of a stream that failed to start, which serves no
// watch: the next start reads a new boundary once the bus captures every
// write. Later reports are ignored, so a late gap cannot hold the floors again.
func (g *UnknownGaps) Abandon() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.abandoned = true
	if g.reported > 0 {
		g.floors.Release()
	}
}

// release lets resumes through again unless a gap was reported after the
// first covered ones.
func (g *UnknownGaps) release(covered int64) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.reported == covered {
		g.floors.Release()
	}
}

// RaiseFloors raises the floors after each reported gap and only then
// releases the held resumes. It retries until the boundary can be read: until
// then a resume could miss the lost writes. It returns when ctx ends or done
// is closed; ctx can outlive the backend, so the retries must end with it too.
func (g *UnknownGaps) RaiseFloors(ctx context.Context, done <-chan struct{}) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		select {
		case <-done:
			cancel()
		case <-ctx.Done():
		}
	}()
	for {
		select {
		case <-ctx.Done():
			return
		case <-g.signal:
		}
		covered := g.count()
		bo := backoff.New(ctx, backoff.Config{MinBackoff: 100 * time.Millisecond, MaxBackoff: 10 * time.Second})
		for bo.Ongoing() {
			err := g.raise(ctx)
			if err == nil {
				break
			}
			if ctx.Err() == nil {
				g.log.Warn("failed to raise watch resume floors after a bus drop or reconnect, resumes stay held", "error", err)
			}
			bo.Wait()
		}
		if ctx.Err() != nil {
			return
		}
		g.release(covered)
	}
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
