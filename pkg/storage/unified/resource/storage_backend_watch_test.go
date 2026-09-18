package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"strings"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/log/logtest"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func durableWatchEvent(rv int64) Event {
	return Event{Namespace: watchTestNamespace, Group: watchTestGroup, Resource: watchTestResource,
		Name: fmt.Sprintf("playlist-%d", rv), ResourceVersion: rv, Action: DataActionCreated}
}

func saveWatchEvent(t *testing.T, backend *kvStorageBackend, event Event) {
	t.Helper()
	require.NoError(t, backend.dataStore.Save(t.Context(), eventDataKey(event), strings.NewReader(fmt.Sprintf(`{"metadata":{"name":%q}}`, event.Name))))
	require.NoError(t, backend.eventStore.Save(t.Context(), event))
}

func TestKVWatchSeedBoundaries(t *testing.T) {
	for _, count := range []int{0, 3, 700} {
		t.Run(fmt.Sprint(count), func(t *testing.T) {
			store := &countingKV{KV: setupBadgerKV(t)}
			backend := setupTestStorageBackend(t, withKV(store))
			base := snowflakeFromTime(time.Now().Add(-24 * time.Hour))
			for i := range count {
				saveWatchEvent(t, backend, durableWatchEvent(base+int64(i)))
			}
			handoffRV := snowflakeFromTime(time.Now())
			if count > 0 {
				handoffRV = base + int64(count-1)
			}
			seed, err := backend.loadWatchSeed(t.Context(), handoffRV)
			require.NoError(t, err)
			require.Len(t, seed.events, min(count, defaultCacheSize))
			if count == 0 {
				require.Equal(t, handoffRV, seed.initialCacheFloor)
				require.Equal(t, handoffRV, seed.highestRV)
			} else {
				require.Equal(t, base+int64(max(0, count-defaultCacheSize)), seed.initialCacheFloor)
				require.Equal(t, base+int64(count-1), seed.highestRV)
				for i, event := range seed.events {
					require.Equal(t, seed.initialCacheFloor+int64(i), event.ResourceVersion)
					require.NotEmpty(t, event.Value)
				}
			}
			trips, keys := store.stats()
			require.Equal(t, min(count, defaultCacheSize), keys)
			require.Equal(t, (min(count, defaultCacheSize)+dataBatchSize-1)/dataBatchSize, trips)

			listRV, err := backend.ListIterator(t.Context(), &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{Namespace: watchTestNamespace, Group: watchTestGroup, Resource: watchTestResource},
			}}, func(ListIterator) error { return nil })
			require.NoError(t, err)
			require.GreaterOrEqual(t, listRV, seed.initialCacheFloor, "fresh idle LIST must not repeatedly expire")
		})
	}
}

func TestIntegrationKVWatchSeedConcurrentCleanup(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	const count = 3 * readEventBatchSize
	for _, store := range []struct {
		name  string
		setup func(*testing.T) KV
	}{
		{name: "badger", setup: setupBadgerKV},
		{name: "sqlkv", setup: setupSqlKV},
	} {
		t.Run(store.name, func(t *testing.T) {
			for _, tc := range []struct {
				name        string
				beforeBatch int
				pruned      int
				first       int
			}{
				{name: "partial page before reads", beforeBatch: 1, pruned: readEventBatchSize / 2, first: readEventBatchSize / 2},
				{name: "all metadata before reads", beforeBatch: 1, pruned: count, first: count},
				{name: "cleanup overtakes reads", beforeBatch: 2, pruned: 2 * readEventBatchSize, first: 2 * readEventBatchSize},
				{name: "partial page between reads", beforeBatch: 2, pruned: readEventBatchSize + readEventBatchSize/2, first: readEventBatchSize + readEventBatchSize/2},
				{name: "all metadata between reads", beforeBatch: 2, pruned: count, first: 2 * readEventBatchSize},
				{name: "partial final page", beforeBatch: 3, pruned: readEventBatchSize / 2, first: readEventBatchSize / 2},
			} {
				t.Run(tc.name, func(t *testing.T) {
					backend := setupTestStorageBackend(t, withKV(store.setup(t)))
					base := time.Now().Add(-2 * time.Hour).Truncate(time.Millisecond)
					events := make([]Event, count)
					for i := range events {
						events[i] = durableWatchEvent(snowflakeFromTime(base.Add(time.Duration(i) * time.Millisecond)))
						saveWatchEvent(t, backend, events[i])
					}
					probe := &eventStoreKVProbe{KV: backend.kv, t: t}
					probe.batch = func(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
						if len(probe.batches) == tc.beforeBatch {
							cutoff := base.Add(time.Duration(tc.pruned) * time.Millisecond)
							deleted, err := newEventStore(backend.kv).CleanupOldEvents(ctx, cutoff)
							require.NoError(t, err)
							require.Equal(t, tc.pruned, deleted)
						}
						return backend.kv.BatchGet(ctx, section, keys)
					}
					backend.eventStore = newEventStore(probe)
					handoffRV := events[count-1].ResourceVersion
					seed, err := backend.loadWatchSeed(t.Context(), handoffRV)
					require.NoError(t, err)
					require.Len(t, seed.events, count-tc.first)
					if tc.first == count {
						require.Equal(t, handoffRV, seed.initialCacheFloor)
						require.Equal(t, handoffRV, seed.highestRV)
					} else {
						require.Equal(t, events[tc.first].ResourceVersion, seed.initialCacheFloor)
						require.Equal(t, events[count-1].ResourceVersion, seed.highestRV)
						for i, event := range seed.events {
							require.Equal(t, events[tc.first+i].ResourceVersion, event.ResourceVersion)
							require.NotEmpty(t, event.Value)
						}
					}
					probe.assertClosed()
					require.Equal(t, []ListOptions{{Sort: SortOrderDesc, Limit: defaultCacheSize, EndKey: fmt.Sprintf("%d", handoffRV+1)}}, probe.scans)
					require.Len(t, probe.batches, 3)
					for i, batch := range probe.batches {
						require.Len(t, batch, readEventBatchSize)
						for j, key := range batch {
							require.Equal(t, eventStoreTestKey(events[count-1-i*readEventBatchSize-j]), key)
						}
					}

					b, _ := newWatchBroadcaster(t, seed.initialCacheFloor, seed.events...)
					gr := GroupResource{Group: watchTestGroup, Resource: watchTestResource}
					stream, err := checkedWatch(t, b, gr, seed.initialCacheFloor-1)
					require.True(t, IsResourceVersionExpired(err), "expected expiry, got %v", err)
					require.Nil(t, stream)
					stream, err = checkedWatch(t, b, gr, seed.initialCacheFloor)
					require.NoError(t, err)
					require.Len(t, stream, len(seed.events))
					for _, event := range seed.events {
						require.Equal(t, event, <-stream)
					}
					b.Unsubscribe(stream)

					listRV, err := backend.ListIterator(t.Context(), &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
						Key: &resourcepb.ResourceKey{Namespace: watchTestNamespace, Group: watchTestGroup, Resource: watchTestResource},
					}}, func(ListIterator) error { return nil })
					require.NoError(t, err)
					require.GreaterOrEqual(t, listRV, seed.initialCacheFloor)
					stream, err = checkedWatch(t, b, gr, listRV)
					require.NoError(t, err, "fresh LIST must not repeatedly expire")
					b.Unsubscribe(stream)
				})
			}
		})
	}
}

func TestKVWatchSeedAllBulkBoundary(t *testing.T) {
	backend := setupTestStorageBackend(t)
	event := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
	event.PreviousRV = -1
	require.NoError(t, backend.eventStore.Save(t.Context(), event))
	seed, err := backend.loadWatchSeed(t.Context(), event.ResourceVersion)
	require.NoError(t, err)
	require.Empty(t, seed.events)
	require.Equal(t, event.ResourceVersion, seed.initialCacheFloor)
	require.Equal(t, event.ResourceVersion, seed.highestRV)
}

func TestKVWatchSeedUnreadablePayload(t *testing.T) {
	store := &unreadableValueKV{KV: setupBadgerKV(t), nameMatch: "playlist-", err: errors.New("unreadable payload")}
	backend := setupTestStorageBackend(t, withKV(store))
	event := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
	saveWatchEvent(t, backend, event)
	seed, err := backend.loadWatchSeed(t.Context(), event.ResourceVersion)
	require.ErrorContains(t, err, "unreadable payload")
	require.Equal(t, watchSeed{}, seed)
}

func TestKVWatchSeedPreviousMetadataAndBulkFiltering(t *testing.T) {
	for _, previousMetadata := range []bool{false, true} {
		t.Run(fmt.Sprint(previousMetadata), func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			rv := snowflakeFromTime(time.Now().Add(-time.Hour))
			created := durableWatchEvent(rv)
			created.Folder = "old-folder"
			saveWatchEvent(t, backend, created)
			updated := created
			updated.ResourceVersion++
			updated.PreviousRV = rv
			updated.Action = DataActionUpdated
			updated.Folder = "new-folder"
			if previousMetadata {
				updated.PreviousAction = created.Action
				updated.PreviousFolder = created.Folder
			}
			saveWatchEvent(t, backend, updated)
			deleted := updated
			deleted.ResourceVersion++
			deleted.PreviousRV = updated.ResourceVersion
			deleted.Action = DataActionDeleted
			if previousMetadata {
				deleted.PreviousAction = updated.Action
				deleted.PreviousFolder = updated.Folder
			}
			saveWatchEvent(t, backend, deleted)
			bulk := durableWatchEvent(rv + 3)
			bulk.PreviousRV = -1
			// Excluded bulk events don't require a watch payload.
			require.NoError(t, backend.eventStore.Save(t.Context(), bulk))
			seed, err := backend.loadWatchSeed(t.Context(), bulk.ResourceVersion)
			require.NoError(t, err)
			require.Len(t, seed.events, 3)
			require.Equal(t, bulk.ResourceVersion, seed.highestRV)
			for i, event := range []Event{created, updated, deleted} {
				require.Equal(t, event.PreviousRV, seed.events[i].PreviousRV)
				require.Equal(t, event.PreviousAction, seed.events[i].PreviousAction)
				require.Equal(t, event.PreviousFolder, seed.events[i].PreviousFolder)
			}
			require.NoError(t, backend.dataStore.Delete(t.Context(), eventDataKey(created)))
			seed, err = backend.loadWatchSeed(t.Context(), bulk.ResourceVersion)
			require.NoError(t, err)
			require.Len(t, seed.events, 2)
			require.Equal(t, updated.ResourceVersion, seed.initialCacheFloor)
			require.Equal(t, bulk.ResourceVersion, seed.highestRV)
		})
	}
}

func TestKVWatchSeedDoesNotRequirePreviousPayload(t *testing.T) {
	for _, previousMetadata := range []bool{false, true} {
		t.Run(fmt.Sprint(previousMetadata), func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			event := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
			event.Action = DataActionUpdated
			event.PreviousRV = event.ResourceVersion - 1
			if previousMetadata {
				event.PreviousAction = DataActionCreated
				event.PreviousFolder = "old-folder"
			}
			saveWatchEvent(t, backend, event)

			seed, err := backend.loadWatchSeed(t.Context(), event.ResourceVersion)
			require.NoError(t, err)
			require.Len(t, seed.events, 1)
			require.Equal(t, event.PreviousRV, seed.events[0].PreviousRV)
			require.NotEmpty(t, seed.events[0].Value)
		})
	}
}

func TestKVWatchSeedSkipsMissingPayloads(t *testing.T) {
	for _, tc := range []struct {
		name     string
		missing  []int
		retained []int
		floor    int
	}{
		{name: "oldest", missing: []int{0}, retained: []int{1, 2}, floor: 1},
		{name: "middle", missing: []int{1}, retained: []int{0, 2}, floor: 0},
		{name: "latest", missing: []int{2}, retained: []int{0, 1}, floor: 0},
		{name: "all", missing: []int{0, 1, 2}, floor: 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := setupTestStorageBackend(t)
			base := snowflakeFromTime(time.Now().Add(-time.Hour))
			for i := range 3 {
				saveWatchEvent(t, backend, durableWatchEvent(base+int64(i)))
			}
			for _, i := range tc.missing {
				require.NoError(t, backend.dataStore.Delete(t.Context(), eventDataKey(durableWatchEvent(base+int64(i)))))
			}
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			seed, stream, err := backend.watchWriteEventsWithSeed(ctx)
			defer func() {
				cancel()
				if stream != nil {
					for range stream {
					}
				}
			}()
			require.NoError(t, err)
			require.NotNil(t, stream)
			require.Len(t, seed.events, len(tc.retained))
			for i, offset := range tc.retained {
				require.Equal(t, base+int64(offset), seed.events[i].ResourceVersion)
				require.NotEmpty(t, seed.events[i].Value)
			}
			require.Equal(t, base+int64(tc.floor), seed.initialCacheFloor)
			require.Equal(t, base+2, seed.highestRV)

			rv, err := backend.ListIterator(ctx, &resourcepb.ListRequest{Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{Namespace: watchTestNamespace, Group: watchTestGroup, Resource: watchTestResource},
			}}, func(ListIterator) error { return nil })
			require.NoError(t, err)
			require.GreaterOrEqual(t, rv, seed.initialCacheFloor)
		})
	}
}

type watchSeedFaultKV struct {
	KV
	section string
	after   int
}

func (k *watchSeedFaultKV) BatchGet(ctx context.Context, section string, keys []string) iter.Seq2[kv.KeyValue, error] {
	if section != k.section {
		return k.KV.BatchGet(ctx, section, keys)
	}
	return func(yield func(kv.KeyValue, error) bool) {
		if k.after > 0 {
			read := 0
			for obj, err := range k.KV.BatchGet(ctx, section, keys) {
				if !yield(obj, err) || err != nil {
					return
				}
				read++
				if read == k.after {
					break
				}
			}
		}
		yield(kv.KeyValue{}, errors.New("seed read failed"))
	}
}

func TestKVWatchSeedReadFailure(t *testing.T) {
	for _, section := range []string{eventsSection, dataSection} {
		t.Run(section, func(t *testing.T) {
			store := &watchSeedFaultKV{KV: setupBadgerKV(t), section: section}
			backend := setupTestStorageBackend(t, withKV(store))
			event := durableWatchEvent(snowflakeFromTime(time.Now().Add(-time.Hour)))
			saveWatchEvent(t, backend, event)
			seed, err := backend.loadWatchSeed(t.Context(), event.ResourceVersion)
			require.ErrorContains(t, err, "seed read failed")
			require.Equal(t, watchSeed{}, seed)
		})
	}
}

type watchSeedHookKV struct {
	KV
	snapshot func()
}

func (k *watchSeedHookKV) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	if section != eventsSection || opts.Limit != defaultCacheSize || opts.Sort != SortOrderDesc {
		return k.KV.Keys(ctx, section, opts)
	}
	return func(yield func(string, error) bool) {
		var keys []string
		for key, err := range k.KV.Keys(ctx, section, opts) {
			if err != nil {
				yield("", err)
				return
			}
			keys = append(keys, key)
		}
		k.snapshot()
		for _, key := range keys {
			if !yield(key, nil) {
				return
			}
		}
	}
}

func TestKVWatchRestartHandoff(t *testing.T) {
	for _, channel := range []bool{false, true} {
		t.Run(fmt.Sprintf("channel=%t", channel), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			scanned, finishScan := make(chan struct{}), make(chan struct{})
			store := &watchSeedHookKV{KV: setupBadgerKV(t), snapshot: func() {
				close(scanned)
				select {
				case <-finishScan:
				case <-ctx.Done():
				}
			}}
			old := setupTestStorageBackend(t, withKV(store))
			rv := snowflakeFromTime(time.Now().Add(-time.Hour))
			saveWatchEvent(t, old, durableWatchEvent(rv))
			backend := setupTestStorageBackend(t, withKV(store), func(opts *KVBackendOptions) {
				opts.UseChannelNotifier = channel
				opts.WatchOptions.MinBackoff = time.Millisecond
			})
			type result struct {
				seed   watchSeed
				stream <-chan *WrittenEvent
				err    error
			}
			done := make(chan result, 1)
			go func() {
				seed, stream, err := backend.watchWriteEventsWithSeed(ctx)
				done <- result{seed, stream, err}
			}()
			select {
			case <-scanned:
			case <-ctx.Done():
				t.Fatal("snapshot did not start")
			}
			// This write is after the snapshot keys were captured, but before
			// hydration and installation. It must arrive through live capture.
			second := durableWatchEvent(rv + 1)
			saveWatchEvent(t, backend, second)
			backend.notifier.Publish(second)
			close(finishScan)
			res := <-done
			require.NoError(t, res.err)
			// Delivery can start before the consumer installs the returned seed.
			third := durableWatchEvent(rv + 2)
			saveWatchEvent(t, backend, third)
			backend.notifier.Publish(third)
			// An overlapping notification must not duplicate the seeded event.
			backend.notifier.Publish(durableWatchEvent(rv))
			require.Len(t, res.seed.events, 1)
			require.Equal(t, rv, res.seed.events[0].ResourceVersion)
			for _, want := range []int64{rv + 1, rv + 2} {
				select {
				case event := <-res.stream:
					require.NotNil(t, event)
					require.Equal(t, want, event.ResourceVersion)
				case <-ctx.Done():
					t.Fatal("missing handoff event")
				}
			}
			select {
			case event := <-res.stream:
				t.Fatalf("unexpected duplicate: %v", event)
			case <-time.After(20 * time.Millisecond):
			}
		})
	}
}

func TestKVWatchSeedCleanupHandoff(t *testing.T) {
	for _, channel := range []bool{false, true} {
		t.Run(fmt.Sprintf("channel=%t", channel), func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			store := &watchSeedHookKV{KV: setupBadgerKV(t)}
			backend := setupTestStorageBackend(t, withKV(store), func(opts *KVBackendOptions) {
				opts.UseChannelNotifier = channel
				opts.WatchOptions.MinBackoff = time.Millisecond
			})
			old := durableWatchEvent(snowflakeFromTime(time.Now().Add(-2 * time.Hour)))
			saveWatchEvent(t, backend, old)
			var captured Event
			store.snapshot = func() {
				deleted, err := backend.eventStore.CleanupOldEvents(ctx, time.Now().Add(-time.Hour))
				require.NoError(t, err)
				require.Equal(t, 1, deleted)
				// This write is not in the enumerated keys and must survive the empty-seed handoff.
				captured = durableWatchEvent(backend.snowflake.Generate().Int64())
				saveWatchEvent(t, backend, captured)
				backend.notifier.Publish(captured)
			}
			seed, stream, err := backend.watchWriteEventsWithSeed(ctx)
			defer func() {
				cancel()
				if stream != nil {
					for range stream {
					}
				}
			}()
			require.NoError(t, err)
			require.Empty(t, seed.events)
			require.Equal(t, old.ResourceVersion, seed.initialCacheFloor)
			require.Equal(t, seed.initialCacheFloor, seed.highestRV)
			require.Greater(t, captured.ResourceVersion, seed.highestRV)
			live := durableWatchEvent(backend.snowflake.Generate().Int64())
			saveWatchEvent(t, backend, live)
			backend.notifier.Publish(live)
			for _, want := range []Event{captured, live} {
				select {
				case event := <-stream:
					require.NotNil(t, event)
					require.Equal(t, want.ResourceVersion, event.ResourceVersion)
				case <-ctx.Done():
					t.Fatal("missing live event after seed cleanup")
				}
			}
		})
	}
}

func TestKVWatchCancelDuringSeedRead(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	reading := make(chan struct{})
	store := &watchSeedHookKV{KV: setupBadgerKV(t), snapshot: func() {
		close(reading)
		<-ctx.Done()
	}}
	logger := &logtest.Fake{}
	backend := setupTestStorageBackend(t, withKV(store), withLogger(logger))
	done := make(chan error, 1)
	go func() {
		_, _, err := backend.watchWriteEventsWithSeed(ctx)
		done <- err
	}()
	<-reading
	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
		require.Zero(t, logger.WarnLogs.Calls, "shutdown must not trigger the empty-cache fallback")
	case <-time.After(time.Second):
		t.Fatal("cancellation did not stop seed loading")
	}
}

// Avoid the datastore's GC-finalized cache janitor, which synctest cannot join.
func setupWatchEventWorker(t *testing.T) (*kvStorageBackend, *countingKV) {
	t.Helper()
	store := &countingKV{KV: setupBadgerKV(t)}
	return &kvStorageBackend{
		dataStore: &dataStore{kv: store}, eventStore: newEventStore(store), log: log.NewNopLogger(),
	}, store
}

func TestKVWatchEventWorkerBuffersUntilSeed(t *testing.T) {
	for _, closeBeforeHandoff := range []bool{false, true} {
		t.Run(fmt.Sprintf("closeBeforeHandoff=%t", closeBeforeHandoff), func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				backend, store := setupWatchEventWorker(t)
				ctx, cancel := context.WithCancel(t.Context())
				input := make(chan Event)
				handoff := make(chan int64)
				out := make(chan *WrittenEvent)
				inputClosed := false
				go func() {
					defer close(out)
					backend.runSeededWatchEvents(ctx, input, handoff, out)
				}()
				defer func() {
					cancel()
					if !inputClosed {
						close(input)
					}
					for range out {
					}
				}()

				const highestRV = defaultBufferSize
				const count = 2*dataBatchSize + 3
				var expected []int64
				for rv := int64(1); rv <= highestRV+count; rv++ {
					event := durableWatchEvent(rv)
					if rv == highestRV+dataBatchSize {
						event.PreviousRV = -1
					}
					if rv > highestRV && event.PreviousRV >= 0 {
						saveWatchEvent(t, backend, event)
						expected = append(expected, rv)
					}
					input <- event
				}
				if closeBeforeHandoff {
					close(input)
					inputClosed = true
				}
				synctest.Wait()
				require.Empty(t, out)
				trips, keys := store.stats()
				require.Zero(t, trips, "buffering must not hydrate before the seed handoff")
				require.Zero(t, keys)

				handoff <- highestRV
				for _, rv := range expected {
					event := <-out
					require.NotNil(t, event)
					require.Equal(t, rv, event.ResourceVersion)
					require.NotEmpty(t, event.Value)
				}
				trips, keys = store.stats()
				require.Equal(t, (len(expected)+dataBatchSize-1)/dataBatchSize, trips)
				require.Equal(t, len(expected), keys, "overlap and bulk events must not be hydrated")

				if !closeBeforeHandoff {
					input <- durableWatchEvent(highestRV)
					bulk := durableWatchEvent(highestRV + count + 1)
					bulk.PreviousRV = -1
					input <- bulk
					live := durableWatchEvent(highestRV + count + 2)
					saveWatchEvent(t, backend, live)
					input <- live
					require.Equal(t, live.ResourceVersion, (<-out).ResourceVersion)
					close(input)
					inputClosed = true
					_, keys = store.stats()
					require.Equal(t, len(expected)+1, keys)
				}
				_, ok := <-out
				require.False(t, ok)
			})
		})
	}
}

func TestKVWatchEventWorkerBatchesLiveEvents(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		backend, store := setupWatchEventWorker(t)
		ctx, cancel := context.WithCancel(t.Context())
		defer cancel()
		const count = 2*dataBatchSize + 3
		for rv := int64(1); rv <= count+1; rv++ {
			saveWatchEvent(t, backend, durableWatchEvent(rv))
		}
		input := make(chan Event, count)
		handoff := make(chan int64)
		out := make(chan *WrittenEvent)
		go func() {
			defer close(out)
			backend.runSeededWatchEvents(ctx, input, handoff, out)
		}()
		input <- durableWatchEvent(1)
		synctest.Wait()
		handoff <- 0
		synctest.Wait()
		// Block the first delivery so the live backlog is fully queued before hydration resumes.
		for rv := int64(2); rv <= count+1; rv++ {
			input <- durableWatchEvent(rv)
		}
		close(input)
		for rv := int64(1); rv <= count+1; rv++ {
			event := <-out
			require.NotNil(t, event)
			require.Equal(t, rv, event.ResourceVersion)
		}
		_, ok := <-out
		require.False(t, ok)
		trips, keys := store.stats()
		require.Equal(t, 1+(count+dataBatchSize-1)/dataBatchSize, trips)
		require.Equal(t, count+1, keys)
	})
}

func TestKVWatchEventWorkerCancellation(t *testing.T) {
	for _, phase := range []string{"buffering", "pending delivery", "waiting for live", "live delivery"} {
		t.Run(phase, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				backend, _ := setupWatchEventWorker(t)
				event := durableWatchEvent(1)
				saveWatchEvent(t, backend, event)
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				input := make(chan Event, 1)
				handoff := make(chan int64)
				out := make(chan *WrittenEvent)
				go func() {
					defer close(out)
					backend.runSeededWatchEvents(ctx, input, handoff, out)
				}()
				if phase == "buffering" || phase == "pending delivery" {
					input <- event
					synctest.Wait()
				}
				if phase != "buffering" {
					handoff <- 0
				}
				if phase == "live delivery" {
					input <- event
				}
				synctest.Wait()
				cancel()
				close(input)
				synctest.Wait()
				_, ok := <-out
				require.False(t, ok)
			})
		})
	}
}

type gatedShutdownNotifier struct {
	events   chan Event
	canceled chan struct{}
	release  chan struct{}
}

func (n *gatedShutdownNotifier) Watch(ctx context.Context, opts WatchOptions) <-chan Event {
	go func() {
		<-ctx.Done()
		close(n.canceled)
		<-n.release
		close(n.events)
	}()
	opts.captured(nil)
	return n.events
}

func (n *gatedShutdownNotifier) Publish(Event) {}

func TestKVWatchEventWorkerJoinsCapture(t *testing.T) {
	for _, startup := range []string{"ready", "fallback", "failure"} {
		t.Run(startup, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				backend, _ := setupWatchEventWorker(t)
				notifier := &gatedShutdownNotifier{events: make(chan Event), canceled: make(chan struct{}), release: make(chan struct{})}
				backend.notifier = notifier
				backend.watchOpts.SettleDelay = time.Millisecond
				saveWatchEvent(t, backend, durableWatchEvent(100))
				switch startup {
				case "fallback":
					backend.eventStore.kv = &seedScanFailureKV{KV: backend.eventStore.kv}
				case "failure":
					backend.eventStore.kv = &watchHandoffFaultKV{KV: backend.eventStore.kv, err: errors.New("boundary read failed")}
				}
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				started := make(chan struct{})
				done := make(chan error, 1)
				go func() {
					_, stream, err := backend.watchWriteEventsWithSeed(ctx)
					if err == nil {
						close(started)
						for range stream {
						}
					}
					done <- err
				}()
				if startup != "failure" {
					<-started
					cancel()
				}
				<-notifier.canceled
				synctest.Wait()
				returnedEarly := len(done) > 0
				close(notifier.release)
				err := <-done
				require.False(t, returnedEarly, "startup failure and stream closure must wait for notifier shutdown")
				if startup == "failure" {
					require.ErrorContains(t, err, "boundary read failed")
				} else {
					require.NoError(t, err)
				}
			})
		})
	}
}

func TestKVWatchSeedScanFailure(t *testing.T) {
	backend := setupTestStorageBackend(t)
	backend.eventStore.kv = &seedScanFailureKV{KV: backend.eventStore.kv}
	seed, err := backend.loadWatchSeed(t.Context(), snowflakeFromTime(time.Now()))
	require.ErrorContains(t, err, "seed scan failed")
	require.Equal(t, watchSeed{}, seed)
}

type seedScanFailureKV struct{ KV }

func (k *seedScanFailureKV) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	if section == eventsSection && opts.Limit == defaultCacheSize && opts.Sort == SortOrderDesc {
		return func(yield func(string, error) bool) { yield("", errors.New("seed scan failed")) }
	}
	return k.KV.Keys(ctx, section, opts)
}

func TestKVWatchNATSReadinessAndCancellation(t *testing.T) {
	sub := &fakeEventSubscriber{enabled: true, subErr: errors.New("not running")}
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
		opts.EnableNatsNotifier = true
		opts.EventSubscriber = sub
		opts.WatchOptions.MinBackoff = time.Millisecond
		opts.WatchOptions.MaxBackoff = 2 * time.Millisecond
		opts.WatchOptions.SettleDelay = 30 * time.Millisecond
	})
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	done := make(chan error, 1)
	go func() {
		_, _, err := backend.watchWriteEventsWithSeed(ctx)
		done <- err
	}()
	select {
	case err := <-done:
		t.Fatalf("subscription retries are not established capture: %v", err)
	case <-time.After(2 * backend.watchOpts.SettleDelay):
	}
	beforeCapture := time.Now()
	sub.setSubErr(nil)
	select {
	case err := <-done:
		require.NoError(t, err)
		require.GreaterOrEqual(t, time.Since(beforeCapture), backend.watchOpts.SettleDelay)
	case <-time.After(time.Second):
		t.Fatal("watch did not become ready")
	}
	cancel()

	sub.setSubErr(errors.New("not running"))
	ctx, cancel = context.WithCancel(t.Context())
	defer cancel()
	go func() {
		_, _, err := backend.watchWriteEventsWithSeed(ctx)
		done <- err
	}()
	cancel()
	select {
	case err := <-done:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(time.Second):
		t.Fatal("canceled startup blocked")
	}
}
