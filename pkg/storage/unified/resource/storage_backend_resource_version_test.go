package resource

import (
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
			backend := setupTestStorageBackend(t, func(opts *KVBackendOptions) { opts.DisableStorageServices = true })
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
			require.Equal(t, float64(1), promtest.ToFloat64(backend.metrics.ResourceVersionGenerationFailures.WithLabelValues(reason)))
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
	responses, err := backend.BatchReadResource(t.Context(), []*resourcepb.ReadRequest{req}, false)
	require.NoError(t, err)
	for response := range responses {
		require.NotNil(t, response.Error)
		require.EqualValues(t, 400, response.Error.Code)
	}
	req.ResourceVersion = head
	require.Nil(t, backend.ReadResource(t.Context(), req).Error)
	responses, err = backend.BatchReadResource(t.Context(), []*resourcepb.ReadRequest{req}, false)
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
	_, err = backend.BatchReadResource(t.Context(), []*resourcepb.ReadRequest{req}, false)
	require.Error(t, err)
	_, err = backend.eventStore.LastEventKey(t.Context())
	require.ErrorIs(t, err, ErrNotFound)
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
