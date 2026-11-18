package resource

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func resourceVersionWaitObservation(t *testing.T, metrics *kvBackendMetrics, reason, outcome string) *dto.Histogram {
	t.Helper()
	metric := &dto.Metric{}
	observer := metrics.ResourceVersionWaitDuration.WithLabelValues(reason, outcome)
	require.NoError(t, observer.(prometheus.Metric).Write(metric))
	return metric.GetHistogram()
}

func TestResourceVersionRetry(t *testing.T) {
	for _, tc := range []struct {
		name       string
		reason     string
		offset     time.Duration
		node       int64
		regression bool
	}{
		{name: "clock regression", reason: resourceVersionClockRegression, offset: -5 * time.Millisecond, node: 42, regression: true},
		{name: "clock behind", reason: "clock_behind", offset: -5 * time.Millisecond, node: 43},
		{name: "same timestamp", reason: "same_timestamp", node: 41},
		{name: "equal RV", reason: "same_timestamp", node: 42},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				// Synctest's initial clock predates the Snowflake epoch, so use
				// a separate valid timestamp for the generator.
				start := time.UnixMilli(resourceVersionEpoch).Add(time.Hour)
				previous := requireGeneratedResourceVersion(t, newResourceVersionGenerator(42, func() time.Time { return start }))
				g := newResourceVersionGenerator(tc.node, func() time.Time { return start })
				if tc.regression {
					// this will call the inline function above and prime the generator
					// so the first call to g.now below will move backwards
					requireGeneratedResourceVersion(t, g)
				}
				samples := 0
				g.now = func() time.Time {
					samples++
					if samples == 1 {
						return start.Add(tc.offset)
					}
					return start.Add(time.Millisecond)
				}
				backend := &kvStorageBackend{
					resourceVersions:       g,
					resourceVersionMaxWait: time.Second,
					metrics:                newKVBackendMetrics(prometheus.NewRegistry()),
					log:                    &logging.NoOpLogger{},
				}
				rv, err := backend.generateResourceVersionWithRetry(t.Context(), previous)
				require.NoError(t, err)
				require.Greater(t, rv, previous)
				require.Equal(t, 2, samples)
				observation := resourceVersionWaitObservation(t, backend.metrics, tc.reason, "recovered")
				require.EqualValues(t, 1, observation.GetSampleCount())
				wantWait := time.Millisecond - tc.offset
				if tc.regression {
					wantWait = -tc.offset
				}
				require.Equal(t, wantWait.Seconds(), observation.GetSampleSum())
				require.Zero(t, resourceVersionWaitObservation(t, backend.metrics, tc.reason, "exhausted").GetSampleCount())
			})
		})
	}
}

func TestResourceVersionRetryExhausted(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		now := time.UnixMilli(resourceVersionEpoch).Add(time.Hour)
		backend := &kvStorageBackend{
			resourceVersions:       newResourceVersionGenerator(41, func() time.Time { return now }),
			resourceVersionMaxWait: 10 * time.Millisecond,
			metrics:                newKVBackendMetrics(prometheus.NewRegistry()),
			log:                    &logging.NoOpLogger{},
		}
		previous := requireGeneratedResourceVersion(t, newResourceVersionGenerator(42, func() time.Time { return now }))
		rv, err := backend.generateResourceVersionWithRetry(t.Context(), previous)
		require.Zero(t, rv)
		var ordering *resourceVersionOrderingError
		require.ErrorAs(t, err, &ordering)
		observation := resourceVersionWaitObservation(t, backend.metrics, "same_timestamp", "exhausted")
		require.EqualValues(t, 1, observation.GetSampleCount())
		require.Equal(t, backend.resourceVersionMaxWait.Seconds(), observation.GetSampleSum())
		require.Zero(t, resourceVersionWaitObservation(t, backend.metrics, "same_timestamp", "recovered").GetSampleCount())
	})
}

func TestResourceVersionRetryDisabled(t *testing.T) {
	for _, tc := range []struct {
		name       string
		offset     time.Duration
		node       int64
		regression bool
		wantError  bool
	}{
		{name: "healthy clock", offset: time.Millisecond, node: 42},
		{name: "clock regression", offset: -time.Second, node: 42, regression: true, wantError: true},
		{name: "clock behind", offset: -time.Second, node: 43, wantError: true},
		{name: "same timestamp", node: 41, wantError: true},
		{name: "equal RV", node: 42, wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				started := time.Now()
				now := time.UnixMilli(resourceVersionEpoch).Add(time.Hour)
				previous := requireGeneratedResourceVersion(t, newResourceVersionGenerator(42, func() time.Time { return now }))
				g := newResourceVersionGenerator(tc.node, func() time.Time { return now })
				if tc.regression {
					requireGeneratedResourceVersion(t, g)
				}
				samples := 0
				g.now = func() time.Time {
					samples++
					if samples == 1 {
						return now.Add(tc.offset)
					}
					return now.Add(time.Millisecond)
				}
				backend := &kvStorageBackend{
					resourceVersions:       g,
					resourceVersionMaxWait: -time.Second,
					metrics:                newKVBackendMetrics(prometheus.NewRegistry()),
					log:                    &logging.NoOpLogger{},
				}
				rv, err := backend.generateResourceVersionWithRetry(t.Context(), previous)
				if tc.wantError {
					require.Zero(t, rv)
					if tc.regression {
						var failure *resourceVersionGenerationError
						require.ErrorAs(t, err, &failure)
						require.Equal(t, resourceVersionClockRegression, failure.reason)
					} else {
						var ordering *resourceVersionOrderingError
						require.ErrorAs(t, err, &ordering)
						require.Equal(t, previous, ordering.minimumRV)
						require.LessOrEqual(t, ordering.rv, previous)
					}
				} else {
					require.NoError(t, err)
					require.Greater(t, rv, previous)
				}
				require.Equal(t, 1, samples)
				require.Equal(t, started, time.Now())
				for _, reason := range []string{resourceVersionClockRegression, "clock_behind", "same_timestamp"} {
					for _, outcome := range []string{"recovered", "exhausted", "canceled"} {
						require.Zero(t, resourceVersionWaitObservation(t, backend.metrics, reason, outcome).GetSampleCount())
					}
				}
			})
		})
	}
}

func TestResourceVersionRetryCancellation(t *testing.T) {
	for _, regression := range []bool{false, true} {
		t.Run(map[bool]string{false: "ordering", true: "clock regression"}[regression], func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				started := time.Now()
				now := time.UnixMilli(resourceVersionEpoch).Add(time.Hour)
				previous := requireGeneratedResourceVersion(t, newResourceVersionGenerator(42, func() time.Time { return now }))
				g := newResourceVersionGenerator(42, func() time.Time { return now })
				if regression {
					requireGeneratedResourceVersion(t, g)
				}
				samples := 0
				g.now = func() time.Time {
					samples++
					return now.Add(-time.Second)
				}
				backend := &kvStorageBackend{
					resourceVersions:       g,
					resourceVersionMaxWait: 5 * time.Second,
					metrics:                newKVBackendMetrics(prometheus.NewRegistry()),
					log:                    &logging.NoOpLogger{},
				}
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				result := make(chan error, 1)
				go func() {
					_, err := backend.generateResourceVersionWithRetry(ctx, previous)
					result <- err
				}()
				synctest.Wait()
				require.Equal(t, 1, samples)
				require.Empty(t, result)

				// Other resources must be able to use the shared generator during the wait.
				generated := make(chan struct{})
				go func() {
					_, _ = g.Generate()
					close(generated)
				}()
				synctest.Wait()
				select {
				case <-generated:
				default:
					t.Fatal("retry held the shared generator mutex")
				}
				cancel()
				synctest.Wait()
				select {
				case err := <-result:
					require.ErrorIs(t, err, context.Canceled)
				default:
					t.Fatal("retry did not respect cancellation")
				}
				require.Equal(t, started, time.Now())
				reason := "clock_behind"
				if regression {
					reason = resourceVersionClockRegression
				}
				require.EqualValues(t, 1, resourceVersionWaitObservation(t, backend.metrics, reason, "canceled").GetSampleCount())
			})
		})
	}
}

func TestResourceVersionRetryDoesNotWaitWithoutRecoverableDrift(t *testing.T) {
	for _, outOfRange := range []bool{false, true} {
		t.Run(map[bool]string{false: "healthy clock", true: "out of range"}[outOfRange], func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				started := time.Now()
				now := time.UnixMilli(resourceVersionEpoch).Add(time.Hour)
				if outOfRange {
					now = time.UnixMilli(resourceVersionEpoch - 1)
				}
				samples := 0
				backend := &kvStorageBackend{
					resourceVersions: newResourceVersionGenerator(42, func() time.Time {
						samples++
						return now
					}),
					resourceVersionMaxWait: time.Second,
					metrics:                newKVBackendMetrics(prometheus.NewRegistry()),
					log:                    &logging.NoOpLogger{},
				}
				_, err := backend.generateResourceVersionWithRetry(t.Context(), 0)
				if outOfRange {
					require.Error(t, err)
				} else {
					require.NoError(t, err)
				}
				require.Equal(t, 1, samples)
				require.Equal(t, started, time.Now())
				for _, reason := range []string{resourceVersionClockRegression, "clock_behind", "same_timestamp"} {
					for _, outcome := range []string{"recovered", "exhausted", "canceled"} {
						require.Zero(t, resourceVersionWaitObservation(t, backend.metrics, reason, outcome).GetSampleCount())
					}
				}
			})
		})
	}
}

func TestKvStorageBackend_ResourceVersionWaitRecovery(t *testing.T) {
	for _, eventType := range []resourcepb.WatchEvent_Type{resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED} {
		t.Run(eventType.String(), func(t *testing.T) {
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
			now := time.Now()
			g := newResourceVersionGenerator(42, func() time.Time { return now })
			backend.resourceVersions = g
			previous := seedResource(t, backend, t.Context(), "resource", "")
			name := "resource"
			reason := "clock_behind"
			if eventType == resourcepb.WatchEvent_ADDED {
				name = "new-resource"
				reason = resourceVersionClockRegression
			} else {
				g = newResourceVersionGenerator(41, func() time.Time { return now })
				backend.resourceVersions = g
			}
			samples := 0
			g.now = func() time.Time {
				samples++
				if samples == 1 {
					return now.Add(-5 * time.Millisecond)
				}
				return now.Add(time.Millisecond)
			}
			obj, err := createTestObjectWithName(name, appsNamespace, "updated")
			require.NoError(t, err)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			event := WriteEvent{Type: eventType, Key: appsKey(name), Value: objectToJSONBytes(t, obj), Object: meta, ObjectOld: meta}
			if eventType != resourcepb.WatchEvent_ADDED {
				event.PreviousRV = previous
			}
			rv, err := backend.WriteEvent(t.Context(), event)
			require.NoError(t, err)
			require.Greater(t, rv, previous)
			require.EqualValues(t, 1, resourceVersionWaitObservation(t, backend.metrics, reason, "recovered").GetSampleCount())
			head, err := backend.eventStore.LastEventKey(t.Context())
			require.NoError(t, err)
			require.Equal(t, rv, head.ResourceVersion)
			response := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{Key: event.Key})
			if eventType == resourcepb.WatchEvent_DELETED {
				require.EqualValues(t, 404, response.Error.GetCode())
			} else {
				require.Nil(t, response.Error)
				require.Equal(t, rv, response.ResourceVersion)
				require.Equal(t, event.Value, response.Value)
			}
		})
	}
}

func TestKvStorageBackend_RecreateResourceVersionOrdering(t *testing.T) {
	for _, tc := range []struct {
		name    string
		offset  time.Duration
		maxWait time.Duration
		recover bool
		reason  string
	}{
		{name: "clock behind recovers", offset: -5 * time.Millisecond, recover: true, reason: "clock_behind"},
		{name: "same timestamp recovers", recover: true, reason: "same_timestamp"},
		{name: "exhausted", offset: -5 * time.Second, maxWait: 2 * time.Millisecond, reason: "clock_behind"},
		{name: "disabled", offset: -5 * time.Millisecond, maxWait: -time.Second, reason: "clock_behind"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
				opts.DisableStorageServices = true
				opts.ResourceVersionMaxWait = tc.maxWait
			})
			now := time.Now()
			backend.resourceVersions = newResourceVersionGenerator(42, func() time.Time { return now })
			created, original := addTestObject(t, backend, t.Context(), appsNamespace, "resource", "original")
			deleted := deleteTestObject(t, backend, t.Context(), original, created, appsNamespace, "resource")
			samples := 0
			backend.resourceVersions = newResourceVersionGenerator(41, func() time.Time {
				samples++
				if tc.recover && samples > 1 {
					return now.Add(time.Millisecond)
				}
				return now.Add(tc.offset)
			})
			obj, err := createTestObjectWithName("resource", appsNamespace, "recreated")
			require.NoError(t, err)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			event := WriteEvent{Type: resourcepb.WatchEvent_ADDED, Key: appsKey("resource"), Value: objectToJSONBytes(t, obj), Object: meta}
			rv, err := backend.WriteEvent(t.Context(), event)
			wantHead := deleted
			wantKeys := 2
			if tc.recover {
				require.NoError(t, err)
				require.Greater(t, rv, deleted)
				require.Equal(t, 2, samples)
				require.EqualValues(t, 1, resourceVersionWaitObservation(t, backend.metrics, tc.reason, "recovered").GetSampleCount())
				wantHead = rv
				wantKeys++
			} else {
				require.Zero(t, rv)
				require.True(t, apierrors.IsServiceUnavailable(err), "error: %v", err)
				if tc.maxWait > 0 {
					require.EqualValues(t, 1, resourceVersionWaitObservation(t, backend.metrics, tc.reason, "exhausted").GetSampleCount())
				} else {
					require.Equal(t, 1, samples)
				}
			}
			response := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{Key: event.Key})
			if tc.recover {
				require.Nil(t, response.Error)
				require.Equal(t, rv, response.ResourceVersion)
				require.Equal(t, event.Value, response.Value)
			} else {
				require.EqualValues(t, 404, response.Error.GetCode())
			}
			head, err := backend.eventStore.LastEventKey(t.Context())
			require.NoError(t, err)
			require.Equal(t, wantHead, head.ResourceVersion)
			if tc.recover {
				stored, err := backend.eventStore.Get(t.Context(), head)
				require.NoError(t, err)
				require.Zero(t, stored.PreviousRV)
				require.Empty(t, stored.PreviousAction)
				require.Empty(t, stored.PreviousFolder)
			}
			keys := 0
			for _, err := range backend.dataStore.Keys(t.Context(), ListRequestKey{
				Group: appsNamespace.Group, Resource: appsNamespace.Resource,
				Namespace: appsNamespace.Namespace, Name: "resource",
			}, SortOrderAsc) {
				require.NoError(t, err)
				keys++
			}
			require.Equal(t, wantKeys, keys)
			events := 0
			for _, err := range backend.eventStore.ListSince(t.Context(), 0) {
				require.NoError(t, err)
				events++
			}
			require.Equal(t, wantKeys, events)
		})
	}
}

func TestKvStorageBackend_ResourceVersionWaitCanceledDoesNotPersist(t *testing.T) {
	for _, lostLease := range []bool{false, true} {
		t.Run(map[bool]string{false: "request deadline", true: "lease lost"}[lostLease], func(t *testing.T) {
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
			now := time.Now()
			backend.resourceVersions = newResourceVersionGenerator(42, func() time.Time { return now })
			previous := seedResource(t, backend, t.Context(), "resource", "")
			original := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{Key: appsKey("resource")})
			require.Nil(t, original.Error)
			backend.resourceVersions = newResourceVersionGenerator(41, func() time.Time { return now.Add(-100 * time.Millisecond) })

			ctx := t.Context()
			wantError := context.Canceled
			if lostLease {
				backend.leaseManager.Stop()
				backend.leaseManager = lease.NewManager(backend.KV(), "test-holder", "storage", nil, lease.WithInternalMinTTL(time.Millisecond))
				backend.leaseTTL = 20 * time.Millisecond
			} else {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, 20*time.Millisecond)
				defer cancel()
				wantError = context.DeadlineExceeded
			}

			obj, err := createTestObjectWithName("resource", appsNamespace, "updated")
			require.NoError(t, err)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			rv, err := backend.WriteEvent(ctx, WriteEvent{
				Type: resourcepb.WatchEvent_MODIFIED, Key: appsKey("resource"),
				Value: objectToJSONBytes(t, obj), Object: meta, ObjectOld: meta, PreviousRV: previous,
			})
			require.Zero(t, rv)
			require.ErrorIs(t, err, wantError)
			require.EqualValues(t, 1, resourceVersionWaitObservation(t, backend.metrics, "clock_behind", "canceled").GetSampleCount())
			response := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{Key: appsKey("resource")})
			require.Nil(t, response.Error)
			require.Equal(t, previous, response.ResourceVersion)
			require.Equal(t, original.Value, response.Value)
			head, err := backend.eventStore.LastEventKey(t.Context())
			require.NoError(t, err)
			require.Equal(t, previous, head.ResourceVersion)
			keys := 0
			for key, err := range backend.dataStore.Keys(t.Context(), ListRequestKey{
				Group: appsNamespace.Group, Resource: appsNamespace.Resource,
				Namespace: appsNamespace.Namespace, Name: "resource",
			}, SortOrderAsc) {
				require.NoError(t, err)
				require.Equal(t, previous, key.ResourceVersion)
				keys++
			}
			require.Equal(t, 1, keys)
		})
	}
}

func TestResourceVersionMaxWaitOptions(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.ResourceVersionMaxWait = 100 * time.Millisecond
	require.Equal(t, cfg.ResourceVersionMaxWait, NewKVBackendOptions(cfg).ResourceVersionMaxWait)
	backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
	require.Equal(t, defaultResourceVersionMaxWait, backend.resourceVersionMaxWait)
}
