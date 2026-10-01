package resource

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type watchSeed struct {
	events            []*WrittenEvent
	initialCacheFloor int64
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
		Key:  &resourcepb.ResourceKey{Namespace: event.Namespace, Group: event.Group, Resource: event.Resource, Name: event.Name},
		Type: kind, Folder: event.Folder, Value: data, ResourceVersion: event.ResourceVersion,
		PreviousRV: event.PreviousRV, PreviousAction: event.PreviousAction, PreviousFolder: event.PreviousFolder,
		Timestamp: ResourceVersionTime(event.ResourceVersion).Unix(),
	}
}

func (k *kvStorageBackend) loadWatchSeed(ctx context.Context, handoffRV int64) (watchSeed, error) {
	seed := watchSeed{initialCacheFloor: handoffRV, highestRV: handoffRV}
	events, err := k.eventStore.latest(ctx, defaultCacheSize, handoffRV)
	if err != nil {
		return watchSeed{}, fmt.Errorf("read watch seed: %w", err)
	}

	keys := make([]DataKey, 0, len(events))
	for _, event := range events {
		if event.PreviousRV < 0 {
			continue
		}
		keys = append(keys, eventDataKey(event))
	}

	values := make(map[DataKey][]byte, len(keys))
	for obj, err := range k.dataStore.BatchGet(ctx, keys) {
		if err != nil {
			return watchSeed{}, fmt.Errorf("hydrate watch seed: %w", err)
		}
		if obj.Value == nil {
			return watchSeed{}, fmt.Errorf("watch seed revision %q has no reader", obj.Key.String())
		}
		data, err := readAndClose(obj.Value)
		if err != nil {
			return watchSeed{}, fmt.Errorf("read watch seed payload: %w", err)
		}
		values[obj.Key] = data
	}
	for _, event := range events {
		if event.PreviousRV < 0 {
			continue
		}
		key := eventDataKey(event)
		data, ok := values[key]
		if !ok {
			// Event metadata can outlive payloads removed by history pruning.
			k.log.Warn("no data for watch seed event, skipping", "key", key.String())
			continue
		}
		seed.events = append(seed.events, eventToWrittenEvent(event, data))
	}
	if len(seed.events) > 0 {
		seed.initialCacheFloor = seed.events[0].ResourceVersion
	}
	return seed, ctx.Err()
}

func (k *kvStorageBackend) watchWriteEventsWithSeed(ctx context.Context) (watchSeed, <-chan *WrittenEvent, error) {
	ctx, cancel := context.WithCancel(ctx)
	started := false
	opts := k.watchOpts
	ready := make(chan error, 1)
	opts.captureReady = ready
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
		k.runSeededWatchEvents(ctx, notifications, boundary, startDelivery, opts.BufferSize, overflow, out)
	}()
	defer func() {
		if !started {
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
settling:
	for {
		select {
		case <-ctx.Done():
			return watchSeed{}, nil, ctx.Err()
		case <-overflow:
			degraded = true
		case <-timer.C:
			break settling
		}
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
	return seed, out, nil
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
			if ctx.Err() != nil || !k.emitWriteEvents(ctx, batch, out) {
				return false
			}
		}
		return ctx.Err() == nil
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
