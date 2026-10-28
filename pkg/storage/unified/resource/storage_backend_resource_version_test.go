package resource

import (
	"strings"
	"testing"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/prometheus/client_golang/prometheus"
	promtest "github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestKvStorageBackend_ResourceVersionForwardJump(t *testing.T) {
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
		opts.DisableStorageServices = true
		opts.SearchLookback = time.Second
	})
	now := time.Now()
	backend.resourceVersions = newResourceVersionGenerator(42, func() time.Time { return now })
	checkpoint := seedResource(t, backend, t.Context(), "checkpoint", "")
	require.Equal(t, now.UnixMilli(), snowflake.ID(checkpoint).Time())
	now = now.Add(38 * time.Second)
	written := seedResource(t, backend, t.Context(), "after-jump", "")
	require.Equal(t, now.UnixMilli(), snowflake.ID(written).Time())

	latest, modified := backend.ListModifiedSince(t.Context(), appsNamespace, checkpoint, nil)
	require.Equal(t, written, latest)
	found := false
	for item, err := range modified {
		require.NoError(t, err)
		if item.Key.Name == "after-jump" {
			found = true
			require.Equal(t, written, item.ResourceVersion)
		}
	}
	require.True(t, found, "the write after the clock jump must be visible with the one-second lookback")
}

func TestKvStorageBackend_ResourceVersionFailureDoesNotPersist(t *testing.T) {
	for _, reason := range []string{resourceVersionClockRegression, resourceVersionTimestampOutOfRange} {
		t.Run(reason, func(t *testing.T) {
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
				opts.DisableStorageServices = true
				opts.ResourceVersionMaxWait = 2 * time.Millisecond
			})
			now := time.Now()
			g := newResourceVersionGenerator(42, func() time.Time { return now })
			backend.resourceVersions = g
			switch reason {
			case resourceVersionClockRegression:
				requireGeneratedResourceVersion(t, g)
				now = now.Add(-38 * time.Second)
			case resourceVersionTimestampOutOfRange:
				now = time.UnixMilli(snowflake.Epoch - 1)
			}
			obj, err := createTestObjectWithName("rejected", appsNamespace, "data")
			require.NoError(t, err)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			rv, err := backend.WriteEvent(t.Context(), WriteEvent{
				Type:   resourcepb.WatchEvent_ADDED,
				Key:    appsKey("rejected"),
				Value:  objectToJSONBytes(t, obj),
				Object: meta,
			})
			require.Zero(t, rv)
			require.True(t, apierrors.IsServiceUnavailable(err), "error: %v", err)
			failures := promtest.ToFloat64(backend.metrics.ResourceVersionGenerationFailures.WithLabelValues(reason))
			require.Equal(t, float64(1), failures)
			if reason == resourceVersionClockRegression {
				require.EqualValues(t, 1, resourceVersionWaitObservation(t, backend.metrics, reason, "exhausted").GetSampleCount())
			}
			_, err = backend.eventStore.LastEventKey(t.Context())
			require.ErrorIs(t, err, ErrNotFound)
			for _, err := range backend.dataStore.Keys(t.Context(), ListRequestKey{
				Group: appsNamespace.Group, Resource: appsNamespace.Resource, Namespace: appsNamespace.Namespace,
			}, SortOrderAsc) {
				require.NoError(t, err)
				t.Fatal("generation failure persisted data")
			}
		})
	}
}

func TestKvStorageBackend_ResourceVersionOrderingAcrossPods(t *testing.T) {
	for _, eventType := range []resourcepb.WatchEvent_Type{resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED} {
		t.Run(eventType.String(), func(t *testing.T) {
			for _, tc := range []struct {
				name         string
				offset       time.Duration
				node         int64
				wantRejected bool
				wantReason   string
			}{
				{name: "clock behind", offset: -5 * time.Second, node: 43, wantRejected: true, wantReason: "clock_behind"},
				{name: "same millisecond lower node", node: 41, wantRejected: true, wantReason: "same_timestamp"},
				{name: "equal RV", node: 42},
				{name: "same millisecond higher node", node: 43},
			} {
				t.Run(tc.name, func(t *testing.T) {
					ctx := t.Context()
					podA := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
						opts.DisableStorageServices = true
						opts.Holder = "pod-a"
					})
					podB := setupTestStorageBackend(t, withKV(podA.KV()), func(opts *KVBackendOptions) {
						opts.DisableStorageServices = true
						opts.Holder = "pod-b"
						opts.ResourceVersionMaxWait = 3 * time.Millisecond
					})
					start := time.Now()
					podA.resourceVersions = newResourceVersionGenerator(42, func() time.Time { return start })
					previousRV := seedResource(t, podA, ctx, "resource", "")
					original := podA.ReadResource(ctx, &resourcepb.ReadRequest{Key: appsKey("resource")})
					require.Nil(t, original.Error)
					now := start.Add(tc.offset)
					podB.resourceVersions = newResourceVersionGenerator(tc.node, func() time.Time { return now })

					obj, err := createTestObjectWithName("resource", appsNamespace, "updated")
					require.NoError(t, err)
					meta, err := utils.MetaAccessor(obj)
					require.NoError(t, err)
					event := WriteEvent{
						Type:       eventType,
						Key:        appsKey("resource"),
						Value:      objectToJSONBytes(t, obj),
						Object:     meta,
						ObjectOld:  meta,
						PreviousRV: previousRV,
					}
					operation := "update"
					if eventType == resourcepb.WatchEvent_DELETED {
						operation = "delete"
					}
					assertRejections := func(count float64) {
						t.Helper()
						for _, metricOperation := range []string{"update", "delete"} {
							for _, reason := range []string{"clock_behind", "same_timestamp"} {
								var want float64
								if metricOperation == operation && reason == tc.wantReason {
									want = count
								}
								require.Equal(t, want, promtest.ToFloat64(podB.metrics.ResourceVersionOrderingRejections.WithLabelValues(metricOperation, reason)))
								require.Zero(t, promtest.ToFloat64(podA.metrics.ResourceVersionOrderingRejections.WithLabelValues(metricOperation, reason)))
							}
						}
					}
					assertRejections(0)
					rv, err := podB.WriteEvent(ctx, event)
					if tc.wantRejected {
						require.Zero(t, rv)
						require.True(t, apierrors.IsServiceUnavailable(err), "error: %v", err)
						assertRejections(1)
						response := podB.ReadResource(ctx, &resourcepb.ReadRequest{Key: event.Key})
						require.Nil(t, response.Error)
						require.Equal(t, previousRV, response.ResourceVersion)
						require.Equal(t, original.Value, response.Value)

						dataKeys := 0
						for key, err := range podB.dataStore.Keys(ctx, ListRequestKey{
							Group: appsNamespace.Group, Resource: appsNamespace.Resource,
							Namespace: appsNamespace.Namespace, Name: "resource",
						}, SortOrderAsc) {
							require.NoError(t, err)
							require.Equal(t, previousRV, key.ResourceVersion)
							dataKeys++
						}
						require.Equal(t, 1, dataKeys, "rejected write must not persist data")
						events := 0
						for stored, err := range podB.eventStore.ListSince(ctx, 0) {
							require.NoError(t, err)
							require.Equal(t, previousRV, stored.ResourceVersion)
							events++
						}
						require.Equal(t, 1, events, "rejected write must not persist an event")

						stale := event
						stale.PreviousRV--
						_, err = podB.WriteEvent(ctx, stale)
						require.True(t, apierrors.IsConflict(err), "error: %v", err)
						assertRejections(1)

						now = start.Add(time.Millisecond)
						rv, err = podB.WriteEvent(ctx, event)
					}
					require.NoError(t, err)
					require.Greater(t, rv, previousRV)
					if tc.wantRejected {
						assertRejections(1)
					} else {
						assertRejections(0)
					}
					head, err := podA.eventStore.LastEventKey(ctx)
					require.NoError(t, err)
					require.Equal(t, rv, head.ResourceVersion)
					response := podA.ReadResource(ctx, &resourcepb.ReadRequest{Key: event.Key})
					if eventType == resourcepb.WatchEvent_DELETED {
						require.NotNil(t, response.Error)
						require.EqualValues(t, 404, response.Error.Code)
					} else {
						require.Nil(t, response.Error)
						require.Equal(t, rv, response.ResourceVersion)
						require.Equal(t, event.Value, response.Value)
					}
				})
			}
		})
	}
}

func TestKvStorageBackend_ResourceVersionOrderingWithRVManager(t *testing.T) {
	for _, eventType := range []resourcepb.WatchEvent_Type{resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED} {
		t.Run(eventType.String(), func(t *testing.T) {
			backend, _ := setupCompatSqlKVStorageBackend(t)
			previousRV := seedResource(t, backend, t.Context(), "resource", "")
			obj, err := createTestObjectWithName("resource", appsNamespace, "updated")
			require.NoError(t, err)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			eventPreviousRV := previousRV
			if eventType == resourcepb.WatchEvent_ADDED {
				previousRV = deleteTestObject(t, backend, t.Context(), obj, previousRV, appsNamespace, "resource")
				eventPreviousRV = 0
			}
			now := time.UnixMilli(snowflakeTimestampMillis(previousRV)).Add(-5 * time.Second)
			backend.resourceVersions = newResourceVersionGenerator(42, func() time.Time { return now })
			rv, err := backend.WriteEvent(t.Context(), WriteEvent{
				Type:       eventType,
				Key:        appsKey("resource"),
				Value:      objectToJSONBytes(t, obj),
				Object:     meta,
				ObjectOld:  meta,
				PreviousRV: eventPreviousRV,
			})
			require.NoError(t, err)
			require.Greater(t, rv, previousRV)
			for _, operation := range []string{"update", "delete"} {
				for _, reason := range []string{"clock_behind", "same_timestamp"} {
					require.Zero(t, promtest.ToFloat64(backend.metrics.ResourceVersionOrderingRejections.WithLabelValues(operation, reason)))
				}
			}
			head, err := backend.eventStore.LastEventKey(t.Context())
			require.NoError(t, err)
			require.Equal(t, rv, head.ResourceVersion)
		})
	}
}

func TestKvStorageBackend_ResourceVersionSequenceWait(t *testing.T) {
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
	now := time.Now()
	g := newResourceVersionGenerator(42, func() time.Time { return now })
	backend.resourceVersions = g
	var previous int64
	for range 4096 {
		previous = requireGeneratedResourceVersion(t, g)
	}
	samples := 0
	g.now = func() time.Time {
		samples++
		if samples == 1 {
			return now
		}
		return now.Add(time.Millisecond)
	}
	rv := seedResource(t, backend, t.Context(), "after-sequence-wait", "")
	require.Equal(t, 2, samples)
	require.Greater(t, rv, previous)
	require.Equal(t, now.UnixMilli()+1, snowflake.ID(rv).Time())
	require.Zero(t, snowflake.ID(rv).Step())
	head, err := backend.eventStore.LastEventKey(t.Context())
	require.NoError(t, err)
	require.Equal(t, rv, head.ResourceVersion)
	response := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{Key: appsKey("after-sequence-wait")})
	require.Nil(t, response.Error)
	require.Equal(t, rv, response.ResourceVersion)
	for _, reason := range []string{resourceVersionClockRegression, resourceVersionTimestampOutOfRange} {
		require.Zero(t, promtest.ToFloat64(backend.metrics.ResourceVersionGenerationFailures.WithLabelValues(reason)))
	}
}

func TestKvStorageBackend_ReadResourceVersionsUseEventHead(t *testing.T) {
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
	head := seedResource(t, backend, t.Context(), "resource", "")
	// A nil generator makes any accidental read-side generation fail the test.
	backend.resourceVersions = nil
	listReq := &resourcepb.ListRequest{Options: &resourcepb.ListOptions{Key: appsKey("resource")}}
	listRV, _, err := backend.listResourceKeys(t.Context(), listReq)
	require.NoError(t, err)
	require.Equal(t, head, listRV)
	historyRV, err := backend.ListHistory(t.Context(), listReq, func(it ListIterator) error {
		for it.Next() {
			require.NoError(t, it.Error())
			require.Equal(t, head, it.ResourceVersion())
		}
		return it.Error()
	})
	require.NoError(t, err)
	require.Equal(t, head, historyRV)

	req := &resourcepb.ReadRequest{Key: appsKey("resource"), ResourceVersion: head + 1}
	response := backend.ReadResource(t.Context(), req)
	require.NotNil(t, response.Error)
	require.EqualValues(t, 400, response.Error.Code)
	responses, err := backend.BatchReadResource(t.Context(), asBatchReads([]*resourcepb.ReadRequest{req}), false)
	require.NoError(t, err)
	for response := range responses {
		require.NotNil(t, response.Error)
		require.EqualValues(t, 400, response.Error.Code)
	}
	req.ResourceVersion = head
	require.Nil(t, backend.ReadResource(t.Context(), req).Error)
	responses, err = backend.BatchReadResource(t.Context(), asBatchReads([]*resourcepb.ReadRequest{req}), false)
	require.NoError(t, err)
	for response := range responses {
		require.Nil(t, response.Error)
		require.Equal(t, head, response.ResourceVersion)
	}
}

func TestKvStorageBackend_EmptyStoreResourceVersion(t *testing.T) {
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
	now := time.Now()
	backend.resourceVersions = newResourceVersionGenerator(42, func() time.Time { return now })
	listReq := &resourcepb.ListRequest{Options: &resourcepb.ListOptions{Key: appsKey("resource")}}
	listRV, _, err := backend.listResourceKeys(t.Context(), listReq)
	require.NoError(t, err)
	require.Positive(t, listRV)
	require.Equal(t, now.UnixMilli(), snowflake.ID(listRV).Time())
	historyRV, err := backend.ListHistory(t.Context(), listReq, func(it ListIterator) error { return nil })
	require.NoError(t, err)
	require.Greater(t, historyRV, listRV)
	require.Equal(t, now.UnixMilli(), snowflake.ID(historyRV).Time())

	now = now.Add(-time.Second)
	_, _, err = backend.listResourceKeys(t.Context(), listReq)
	require.Error(t, err)
	_, err = backend.ListHistory(t.Context(), listReq, func(it ListIterator) error { return nil })
	require.Error(t, err)
	req := &resourcepb.ReadRequest{Key: appsKey("resource"), ResourceVersion: listRV}
	require.NotNil(t, backend.ReadResource(t.Context(), req).Error)
	_, err = backend.BatchReadResource(t.Context(), asBatchReads([]*resourcepb.ReadRequest{req}), false)
	require.Error(t, err)
	_, err = backend.eventStore.LastEventKey(t.Context())
	require.ErrorIs(t, err, ErrNotFound)
}

func TestResourceVersionOrderingMetricsInitialized(t *testing.T) {
	reg := prometheus.NewRegistry()
	newKVBackendMetrics(reg)
	require.NoError(t, promtest.GatherAndCompare(reg, strings.NewReader(`
# HELP grafana_storage_resource_version_ordering_rejections_total Update and delete writes rejected because the generated resource version is not greater than the stored revision, by operation and reason (clock_behind, same_timestamp).
# TYPE grafana_storage_resource_version_ordering_rejections_total counter
grafana_storage_resource_version_ordering_rejections_total{operation="delete",reason="clock_behind"} 0
grafana_storage_resource_version_ordering_rejections_total{operation="delete",reason="same_timestamp"} 0
grafana_storage_resource_version_ordering_rejections_total{operation="update",reason="clock_behind"} 0
grafana_storage_resource_version_ordering_rejections_total{operation="update",reason="same_timestamp"} 0
`), "grafana_storage_resource_version_ordering_rejections_total"))
}

func TestResourceVersionGenerationMetrics(t *testing.T) {
	now := time.Now()
	backend := &kvStorageBackend{
		resourceVersions: newResourceVersionGenerator(1, func() time.Time { return now }),
		metrics:          newKVBackendMetrics(prometheus.NewRegistry()),
		log:              &logging.NoOpLogger{},
	}
	_, err := backend.generateResourceVersion()
	require.NoError(t, err)
	now = now.Add(-38 * time.Second)
	_, err = backend.generateResourceVersion()
	require.Error(t, err)
	require.Equal(t, float64(38), promtest.ToFloat64(backend.metrics.ResourceVersionClockRegression))
	require.Equal(t, float64(1), promtest.ToFloat64(backend.metrics.ResourceVersionGenerationFailures.WithLabelValues(resourceVersionClockRegression)))
	now = now.Add(38 * time.Second)
	_, err = backend.generateResourceVersion()
	require.NoError(t, err)
	require.Zero(t, promtest.ToFloat64(backend.metrics.ResourceVersionClockRegression))
}
