package resource

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"time"

	"github.com/grafana/dskit/backoff"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type watchSeed struct {
	events            []*WrittenEvent
	initialCacheFloor int64
	collectionFloors  map[GroupResource]int64
	highestRV         int64 // fixed before settling; retained events may end below this boundary
}

func writtenEventIdentity(event *WrittenEvent) (GroupResource, int64) {
	return GroupResource{Group: event.Key.Group, Resource: event.Key.Resource}, event.ResourceVersion
}

func eventDataKey(event Event) DataKey {
	return DataKey{
		Group: event.Group, Resource: event.Resource, Namespace: event.Namespace,
		Name: event.Name, ResourceVersion: event.ResourceVersion, Action: event.Action, Folder: event.Folder,
	}
}

func eventToWrittenEvent(event Event, data []byte) *WrittenEvent {
	var kind resourcepb.WatchEvent_Type
	switch event.Action {
	case DataActionCreated:
		kind = resourcepb.WatchEvent_ADDED
	case DataActionUpdated:
		kind = resourcepb.WatchEvent_MODIFIED
	case DataActionDeleted:
		kind = resourcepb.WatchEvent_DELETED
	}
	return &WrittenEvent{
		Key: &resourcepb.ResourceKey{
			Namespace: event.Namespace,
			Group:     event.Group,
			Resource:  event.Resource,
			Name:      event.Name,
		},
		Type:            kind,
		Folder:          event.Folder,
		Value:           data,
		ResourceVersion: event.ResourceVersion,
		PreviousRV:      event.PreviousRV,
		PreviousAction:  event.PreviousAction,
		PreviousFolder:  event.PreviousFolder,
		Timestamp:       ResourceVersionTime(event.ResourceVersion).Unix(),
	}
}

func (k *kvStorageBackend) loadWatchSeed(ctx context.Context, handoffRV int64) (watchSeed, error) {
	return k.loadWatchSeedWithLimit(ctx, handoffRV, defaultCacheMaxBytes)
}

func (k *kvStorageBackend) loadWatchSeedWithLimit(ctx context.Context, handoffRV, maxBytes int64) (watchSeed, error) {
	seed := watchSeed{initialCacheFloor: handoffRV, highestRV: handoffRV}
	if maxBytes <= 0 {
		return seed, ctx.Err()
	}
	events, err := k.eventStore.latest(ctx, defaultCacheSize, handoffRV)
	if err != nil {
		return watchSeed{}, fmt.Errorf("read watch seed: %w", err)
	}

	keys := make([]DataKey, 0, len(events))
	eventsByKey := make(map[DataKey]Event, len(events))
	for i := len(events) - 1; i >= 0; i-- {
		event := events[i]
		if event.PreviousRV < 0 {
			continue
		}
		key := eventDataKey(event)
		keys = append(keys, key)
		eventsByKey[key] = event
	}

	var sizeBytes int64
	for obj, err := range k.dataStore.BatchGet(ctx, keys) {
		if err != nil {
			return watchSeed{}, fmt.Errorf("hydrate watch seed: %w", err)
		}
		if obj.Value == nil {
			return watchSeed{}, fmt.Errorf("watch seed revision %q has no reader", obj.Key.String())
		}
		data, err := kv.ReadAllAndClose(obj.Value)
		if err != nil {
			return watchSeed{}, fmt.Errorf("read watch seed payload: %w", err)
		}
		if int64(cap(data)) > maxBytes-sizeBytes {
			break
		}
		sizeBytes += int64(cap(data))
		seed.events = append(seed.events, eventToWrittenEvent(eventsByKey[obj.Key], data))
		if sizeBytes == maxBytes {
			break
		}
	}
	slices.Reverse(seed.events)
	if len(seed.events) > 0 {
		seed.initialCacheFloor = seed.events[0].ResourceVersion
	}
	return seed, ctx.Err()
}

func (k *kvStorageBackend) watchWriteEventsWithSeed(ctx context.Context, floors *raisedFloors, captured func()) (watchSeed, <-chan *WrittenEvent, error) {
	ctx, cancel := context.WithCancel(ctx)
	started := false
	gaps := &unknownGaps{floors: floors, signal: make(chan struct{}, 1)}
	opts := k.watchOpts
	ready := make(chan error, 1)
	opts.CaptureReady = ready
	opts.Lost = gaps.report
	notifications := k.notifier.Watch(ctx, opts)
	boundary := make(chan int64)
	startDelivery := make(chan struct{})
	overflow := make(chan struct{}, 1)
	out := make(chan *WrittenEvent, defaultBufferSize)
	go func() {
		defer close(out)
		defer func() {
			cancel()
			// Closing the hydrated stream also acknowledges that the notifier has
			// stopped reading storage, before server shutdown closes the backend.
			for range notifications {
			}
		}()
		k.runSeededWatchEvents(ctx, notifications, boundary, startDelivery, opts.BufferSize, overflow, out, k.lostWatchEvents(floors))
	}()
	defer func() {
		if !started {
			gaps.abandon()
			cancel()
			for range out {
			}
		}
	}()
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case err := <-ready:
		if err != nil {
			return watchSeed{}, nil, fmt.Errorf("establish watch capture: %w", err)
		}
	}
	gaps.capture()
	if captured != nil {
		captured()
	}

	// Fix the snapshot ceiling before settling. An unrestricted snapshot taken
	// afterwards could include newer writes ahead of still-persisting lower RVs,
	// causing the overlap filter to discard events that were never seeded.
	handoffRV, err := k.latestResourceVersion(ctx)
	if err != nil {
		return watchSeed{}, nil, fmt.Errorf("read watch handoff boundary: %w", err)
	}
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case boundary <- handoffRV:
	}

	degraded := false
	timer := time.NewTimer(opts.SettleDelay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case <-overflow:
		degraded = true
	case <-timer.C:
	}

	seed := watchSeed{initialCacheFloor: handoffRV, highestRV: handoffRV}
	if !degraded {
		seedCtx, cancelSeed := context.WithCancel(ctx)
		seedDone := make(chan struct{})
		var loaded watchSeed
		var loadErr error
		go func() {
			loaded, loadErr = k.loadWatchSeed(seedCtx, handoffRV)
			close(seedDone)
		}()
		select {
		case <-ctx.Done():
			cancelSeed()
			<-seedDone
			return watchSeed{}, nil, ctx.Err()
		case <-overflow:
			degraded = true
			cancelSeed()
			<-seedDone
		case <-seedDone:
			cancelSeed()
			if loadErr != nil {
				if ctx.Err() != nil {
					return watchSeed{}, nil, ctx.Err()
				}
				k.log.Warn("failed to load watch seed, starting with an empty watch cache", "error", loadErr, "handoff_rv", handoffRV)
			} else {
				seed = loaded
			}
		}
	}
	if degraded {
		k.log.Warn("watch capture reached its pending threshold before seed handoff, starting with an empty watch cache", "handoff_rv", handoffRV, "pending_threshold", opts.BufferSize)
	}
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case startDelivery <- struct{}{}:
	}

	started = true
	go k.raiseFloorsAfterUnknownGaps(ctx, gaps)
	return seed, out, nil
}

// lostWatchEvents raises the floors above writes the stream could not read
// back, then expires the watches. A resume admitted after the expiry takes the
// new generation, so only a floor raised before it can reject the resume.
func (k *kvStorageBackend) lostWatchEvents(floors *raisedFloors) func([]Event) {
	return func(events []Event) {
		if floors != nil {
			for _, e := range events {
				floors.Raise(GroupResource{Group: e.Group, Resource: e.Resource}, e.ResourceVersion)
			}
		}
		if k.watchInvalidator != nil {
			k.watchInvalidator.Invalidate()
		}
	}
}

// unknownGaps holds every resume after a bus drop or reconnect until the floors
// are raised above the writes it may have lost, as the legacy SQL NATS
// notifier does.
type unknownGaps struct {
	floors *raisedFloors
	signal chan struct{}

	mu        sync.Mutex
	captured  bool
	reported  int64
	abandoned bool
}

// capture starts counting gaps. Earlier ones, such as the one a retried first
// subscription reports, are covered by the seed read after capture.
func (g *unknownGaps) capture() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.captured = true
}

func (g *unknownGaps) report() {
	g.mu.Lock()
	if g.floors == nil || !g.captured || g.abandoned {
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

func (g *unknownGaps) count() int64 {
	g.mu.Lock()
	defer g.mu.Unlock()
	return g.reported
}

// abandon releases the hold of a stream that failed to start. Later reports
// are ignored, so a late gap cannot hold the floors again.
func (g *unknownGaps) abandon() {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.abandoned = true
	if g.reported > 0 {
		g.floors.Release()
	}
}

// release lets resumes through again unless a gap was reported after the
// first covered ones.
func (g *unknownGaps) release(covered int64) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.reported == covered {
		g.floors.Release()
	}
}

// raiseFloorsAfterUnknownGaps raises every collection's floor to the latest
// RV, which is above any write lost before a bus drop or reconnect was
// reported, and only then releases the held resumes. It retries until the RV
// can be read: until then a resume could miss the lost writes.
func (k *kvStorageBackend) raiseFloorsAfterUnknownGaps(ctx context.Context, gaps *unknownGaps) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-gaps.signal:
		}
		covered := gaps.count()
		bo := backoff.New(ctx, backoff.Config{MinBackoff: defaultMinBackoff, MaxBackoff: defaultMaxBackoff})
		var latest int64
		for bo.Ongoing() {
			var err error
			if latest, err = k.latestResourceVersion(ctx); err == nil {
				break
			}
			if ctx.Err() == nil {
				k.log.Warn("failed to raise watch resume floors after a bus drop or reconnect, resumes stay held", "error", err)
			}
			bo.Wait()
		}
		if ctx.Err() != nil {
			return
		}
		gaps.floors.raiseAll(latest)
		gaps.release(covered)
	}
}

// Drain capture throughout snapshot reads so startup cannot backpressure an
// at-most-once notifier into dropping writes. Crossing the pending threshold
// tells the caller to abandon the historical seed and hand off promptly, while
// this worker keeps draining notifications. After handoff, the same worker
// hydrates the backlog and then batches directly from the notifier.
func (k *kvStorageBackend) runSeededWatchEvents(
	ctx context.Context,
	input <-chan Event,
	boundary <-chan int64,
	startDelivery <-chan struct{},
	pendingThreshold int,
	overflow chan<- struct{},
	out chan<- *WrittenEvent,
	lost func([]Event),
) {
	var pending []Event
	var highestRV int64
	boundarySet := false
	applyBoundary := func(rv int64) {
		highestRV = rv
		boundarySet = true
		pending = slices.DeleteFunc(pending, func(event Event) bool {
			return event.ResourceVersion <= highestRV || event.PreviousRV < 0
		})
		if len(pending) >= pendingThreshold {
			overflow <- struct{}{}
		}
	}
waiting:
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-input:
			if !ok {
				input = nil
				continue
			}
			if boundarySet && (event.ResourceVersion <= highestRV || event.PreviousRV < 0) {
				continue
			}
			pending = append(pending, event)
			if boundarySet && len(pending) == pendingThreshold {
				overflow <- struct{}{}
			}
		case rv := <-boundary:
			applyBoundary(rv)
		case <-startDelivery:
			break waiting
		}
	}
	emit := func(events []Event) bool {
		events = slices.DeleteFunc(events, func(event Event) bool {
			return event.ResourceVersion <= highestRV || event.PreviousRV < 0
		})
		for batch := range slices.Chunk(events, dataBatchSize) {
			if !k.emitWriteEvents(ctx, batch, out, lost) {
				return false
			}
		}
		return true
	}
	if !emit(pending) {
		return
	}
	buf := make([]Event, 0, dataBatchSize)
	for input != nil && ctx.Err() == nil {
		batch, ok := nextEventBatch(input, buf[:0])
		if !ok || !emit(batch) {
			return
		}
	}
}
