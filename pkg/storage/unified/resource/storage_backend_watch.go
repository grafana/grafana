package resource

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Only KV opts into seeded startup. SQL's independently polled collections do
// not satisfy the global ordering required by these resume boundaries.
type seededWatchBackend interface {
	watchWriteEventsWithSeed(context.Context) (watchSeed, <-chan *WrittenEvent, error)
}

type watchSeed struct {
	events            []*WrittenEvent
	initialCacheFloor int64
	highestRV         int64
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

func writtenEvent(event Event, data []byte) *WrittenEvent {
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

func (k *kvStorageBackend) loadWatchSeed(ctx context.Context, emptyBoundary int64) (watchSeed, error) {
	seed := watchSeed{initialCacheFloor: emptyBoundary, highestRV: emptyBoundary}
	events, err := k.eventStore.latest(ctx, defaultCacheSize)
	if err != nil {
		return watchSeed{}, fmt.Errorf("read watch seed: %w", err)
	}
	if len(events) > 0 {
		seed.highestRV = events[len(events)-1].ResourceVersion
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
		seed.events = append(seed.events, writtenEvent(event, data))
	}
	if len(seed.events) > 0 {
		seed.initialCacheFloor = seed.events[0].ResourceVersion
	} else if len(events) > 0 {
		// An empty replay seed can still have a durable boundary that fresh LISTs use.
		seed.initialCacheFloor = seed.highestRV
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
	handoff := make(chan int64)
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
		k.runSeededWatchEvents(ctx, notifications, handoff, out)
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

	// With an empty durable tail, this explicit boundary rejects old cursors
	// while remaining below fresh LIST RVs, including LISTs during settling.
	emptyBoundary := snowflakeFromTime(time.Now())
	timer := time.NewTimer(opts.SettleDelay)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case <-timer.C:
	}
	seed, err := k.loadWatchSeed(ctx, emptyBoundary)
	if err != nil {
		return watchSeed{}, nil, err
	}
	select {
	case <-ctx.Done():
		return watchSeed{}, nil, ctx.Err()
	case handoff <- seed.highestRV:
	}

	started = true
	return seed, out, nil
}

// Drain capture throughout snapshot reads so startup cannot backpressure an
// at-most-once notifier into dropping writes. After handoff, the same worker
// hydrates the backlog and then batches directly from the notifier.
func (k *kvStorageBackend) runSeededWatchEvents(ctx context.Context, input <-chan Event, handoff <-chan int64, out chan<- *WrittenEvent) {
	var pending []Event
	var highestRV int64
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
			pending = append(pending, event)
		case highestRV = <-handoff:
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
	pending = nil
	buf := make([]Event, 0, dataBatchSize)
	for input != nil && ctx.Err() == nil {
		batch, ok := nextEventBatch(input, buf[:0])
		if !ok || !emit(batch) {
			return
		}
	}
}
