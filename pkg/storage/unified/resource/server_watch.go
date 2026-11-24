package resource

import (
	"context"
	"errors"
	"net/http"
	"runtime/debug"
	"strconv"
	"sync"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/backoff"
	"github.com/hashicorp/golang-lru/v2/simplelru"

	"github.com/grafana/grafana-app-sdk/logging"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

func (s *server) watchState() (*broadcaster[*WrittenEvent], *watchStartup) {
	s.watchMu.Lock()
	defer s.watchMu.Unlock()
	return s.broadcaster, s.watchStartup
}

func (s *server) setWatchState(b *broadcaster[*WrittenEvent], startup *watchStartup) {
	s.watchMu.Lock()
	defer s.watchMu.Unlock()
	s.broadcaster, s.watchStartup = b, startup
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
	b := newBroadcasterWithSizes(s.ctx, out, watchChanSize, defaultOverflowCap, metrics, writtenEventIdentity, &seededCacheConfig[*WrittenEvent]{
		initialize: initialize,
		raised:     raised,
	})
	startup.broadcaster = b
	s.setWatchState(b, startup)
	go func() {
		<-b.terminated
		capture.Wait()
		close(startup.stopped)
	}()
}

const (
	// previousReadsMaxBytes bounds the previous versions kept for watches
	// that deliver an event later than others.
	previousReadsMaxBytes = 32 << 20 // 32 MiB
	previousReadsMaxItems = 4096
	previousReadsTTL      = 30 * time.Second
)

// previousReads shares raw previous revisions between watches. Each watch
// authorizes the revision independently before sending it.
type previousReads struct {
	mu      sync.Mutex // protects the cache and active flights' waiter counts
	flights map[string]*previousReadFlight
	cache   *simplelru.LRU[string, previousRead]
	bytes   int
}

type previousRead struct {
	rsp   *BackendReadResponse
	added time.Time
}

type previousReadResult struct {
	backend  *BackendReadResponse
	response *resourcepb.ReadResponse
	err      error
}

type previousReadLoader func(context.Context, func(*BackendReadResponse)) previousReadResult

type previousReadFlight struct {
	waiters int
	cancel  context.CancelFunc
	owner   chan previousReadResult
	result  previousReadResult // published by closing ready
	ready   chan struct{}
}

func newPreviousReads() *previousReads {
	p := &previousReads{flights: make(map[string]*previousReadFlight)}
	// Only fails for a non-positive size.
	p.cache, _ = simplelru.NewLRU(previousReadsMaxItems, func(_ string, read previousRead) {
		p.bytes -= cap(read.rsp.Value)
	})
	return p
}

func (p *previousReads) get(id string) (*BackendReadResponse, bool) {
	read, ok := p.cache.Get(id)
	if !ok {
		return nil, false
	}
	if time.Since(read.added) > previousReadsTTL {
		p.cache.Remove(id)
		return nil, false
	}
	return read.rsp, true
}

// add keeps rsp, dropping the least recently used reads past the byte limit.
func (p *previousReads) add(id string, rsp *BackendReadResponse) {
	size := cap(rsp.Value)
	if size > previousReadsMaxBytes {
		return
	}
	if p.cache.Contains(id) {
		return
	}
	for p.bytes+size > previousReadsMaxBytes {
		p.cache.RemoveOldest()
	}
	p.cache.Add(id, previousRead{rsp: rsp, added: time.Now()})
	p.bytes += size
}

// read shares the backend read of key at rv. A watch that joined a flight
// late can retry its queue timeout once within the watch's remaining budget.
func (p *previousReads) read(ctx context.Context, key *resourcepb.ResourceKey, rv int64, load previousReadLoader) previousReadResult {
	id := key.Namespace + "/" + key.Group + "/" + key.Resource + "/" + key.Name + "/" + strconv.FormatInt(rv, 10)
	result := p.readOnce(ctx, id, rv, load)
	if !errors.Is(result.err, errQueueTimeout) || ctx.Err() != nil {
		return result
	}
	deadline, hasDeadline := ctx.Deadline()
	// Separate queue and watch timers can fire at the same instant. The
	// watch timer may not have canceled ctx yet even if its budget is gone.
	if hasDeadline && !time.Now().Before(deadline) {
		return previousReadResult{err: context.DeadlineExceeded}
	}
	// Retry through QoS with this watch's own context. Joining another
	// retry could give this watch a shorter deadline than it has left.
	return load(ctx, func(rsp *BackendReadResponse) {
		p.mu.Lock()
		defer p.mu.Unlock()
		if ctx.Err() == nil {
			p.cacheResponse(id, rv, rsp)
		}
	})
}

func (p *previousReads) readOnce(ctx context.Context, id string, rv int64, load previousReadLoader) previousReadResult {
	p.mu.Lock()
	if rsp, ok := p.get(id); ok {
		p.mu.Unlock()
		return previousReadResult{backend: rsp}
	}
	flight := p.flights[id]
	owner := flight == nil
	if owner {
		sharedCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
		flight = &previousReadFlight{
			cancel: cancel,
			ready:  make(chan struct{}),
			owner:  make(chan previousReadResult, 1),
		}
		p.flights[id] = flight
		go p.runFlight(sharedCtx, id, rv, flight, load)
	}
	flight.waiters++
	p.mu.Unlock()
	defer p.leave(id, flight)

	if owner {
		select {
		case <-ctx.Done():
			return previousReadResult{err: ctx.Err()}
		case result := <-flight.owner:
			return result
		}
	}
	select {
	case <-ctx.Done():
		return previousReadResult{err: ctx.Err()}
	case <-flight.ready:
		return flight.result
	}
}

func (p *previousReads) runFlight(ctx context.Context, id string, rv int64, flight *previousReadFlight, load previousReadLoader) {
	defer flight.cancel()
	var once sync.Once
	finish := func(result previousReadResult) {
		once.Do(func() {
			p.mu.Lock()
			defer p.mu.Unlock()
			if p.flights[id] == flight {
				delete(p.flights, id)
				if result.backend != nil {
					p.cacheResponse(id, rv, result.backend)
				}
			}
			flight.result = result
			close(flight.ready)
		})
	}
	result := load(ctx, func(rsp *BackendReadResponse) {
		// Followers can authorize as soon as the backend read completes.
		finish(previousReadResult{backend: rsp})
	})
	// Release followers even if the backend read never produced a result.
	finish(previousReadResult{err: result.err})
	flight.owner <- result
}

// cacheResponse requires p.mu. KV can return an older retained revision
// while pruning history, so successful responses must match the requested RV.
func (p *previousReads) cacheResponse(id string, rv int64, rsp *BackendReadResponse) {
	exact := rsp.Error == nil && rsp.ResourceVersion == rv
	missing := rsp.Error != nil && rsp.Error.Code == http.StatusNotFound
	if exact || missing {
		p.add(id, rsp)
	}
}

func (p *previousReads) leave(id string, flight *previousReadFlight) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.flights[id] == flight {
		flight.waiters--
		if flight.waiters == 0 {
			delete(p.flights, id)
			flight.cancel()
		}
	}
}

var errPreviousReadPanic = errors.New("previous version read panicked")

// readPrevious reads an event's previous version for a watch, sharing the
// backend read with other watches of the event.
func (s *server) readPrevious(ctx context.Context, user claims.AuthInfo, key *resourcepb.ResourceKey, rv int64) (*resourcepb.ReadResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.readPrevious")
	defer span.End()
	ctx, cancel := context.WithTimeout(ctx, s.queueConfig.Timeout)
	defer cancel()
	req := &resourcepb.ReadRequest{Key: key, ResourceVersion: rv}
	result := s.previousReads.read(ctx, key, rv, func(sharedCtx context.Context, publish func(*BackendReadResponse)) (result previousReadResult) {
		defer s.recoverPreviousRead(sharedCtx, &result.err)
		var ownerResult previousReadResult
		if err := s.runInQueue(sharedCtx, key.Namespace, "read", func(queueCtx context.Context) {
			// The queue may run this callback in its own worker goroutine.
			defer s.recoverPreviousRead(queueCtx, &ownerResult.err)
			if queueCtx.Err() != nil {
				return
			}
			rsp := s.backend.ReadResource(queueCtx, req)
			if queueCtx.Err() != nil {
				return
			}
			if rsp == nil {
				panic("previous version backend returned no response")
			}
			publish(rsp)
			// The owner authorizes in this slot with its own deadline and
			// identity. If it left, only the other watches need the result.
			if ctx.Err() == nil {
				ownerResult.response, ownerResult.err = s.readResponse(ctx, user, key, rsp)
			}
		}); err != nil {
			return previousReadResult{err: err}
		}
		return ownerResult
	})
	if ctxErr := ctx.Err(); ctxErr != nil {
		return nil, queueRPCError(ctxErr)
	}
	if result.err != nil {
		return nil, previousReadRPCError(result.err)
	}
	if result.backend == nil {
		return result.response, nil
	}

	// Followers and cache hits authorize with their own identity and QoS slot.
	var resp *resourcepb.ReadResponse
	var authErr error
	if err := s.runInQueue(ctx, key.Namespace, "read", func(ctx context.Context) {
		defer s.recoverPreviousRead(ctx, &authErr)
		resp, authErr = s.readResponse(ctx, user, key, result.backend)
	}); err != nil {
		return nil, previousReadRPCError(err)
	}
	return resp, authErr
}

func previousReadRPCError(err error) error {
	switch {
	case errors.Is(err, errPreviousReadPanic):
		return err
	case errors.Is(err, errQueueTimeout):
		return queueRPCError(context.DeadlineExceeded)
	default:
		return queueRPCError(err)
	}
}

// recoverPreviousRead reports panics to the watch handler before they can
// escape a queue worker or the shared read goroutine.
func (s *server) recoverPreviousRead(ctx context.Context, err *error) {
	if p := recover(); p != nil {
		*err = errPreviousReadPanic
		s.log.FromContext(ctx).Error("recovered from panic in previous version read", "panic", p, "stack", string(debug.Stack()))
	}
}
