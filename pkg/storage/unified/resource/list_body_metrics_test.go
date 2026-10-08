package resource

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestServerListBodyMetrics(t *testing.T) {
	for _, tc := range []struct {
		name           string
		authorizeFirst bool
		maxPageBytes   int
		limit          int64
		resources      int
		denied         bool
		missing        bool
		failFrom       int
		wantRequested  int
		wantConsumed   int
		wantReturned   int
		wantUnused     int
		wantStopReason string
	}{
		{name: "authorize first byte limit", authorizeFirst: true, maxPageBytes: 1, resources: 60, wantRequested: 50, wantConsumed: 1, wantReturned: 1, wantUnused: 49, wantStopReason: listStopByteLimit},
		{name: "fetch first byte limit", maxPageBytes: 1, resources: 60, wantRequested: 60, wantConsumed: 60, wantReturned: 1, wantUnused: 59, wantStopReason: listStopByteLimit},
		{name: "authorize first count limit", authorizeFirst: true, limit: 1, resources: 60, wantRequested: 1, wantConsumed: 1, wantReturned: 1, wantStopReason: listStopCountLimit},
		{name: "fetch first count limit", limit: 1, resources: 60, wantRequested: 60, wantConsumed: 60, wantReturned: 1, wantUnused: 59, wantStopReason: listStopCountLimit},
		{name: "multiple batches exhausted", authorizeFirst: true, resources: 60, wantRequested: 60, wantConsumed: 60, wantReturned: 60, wantStopReason: listStopExhausted},
		{name: "empty", authorizeFirst: true, wantStopReason: listStopExhausted},
		{name: "authorize first denied", authorizeFirst: true, resources: 60, denied: true, wantStopReason: listStopExhausted},
		{name: "fetch first denied", resources: 60, denied: true, wantRequested: 60, wantConsumed: 60, wantUnused: 60, wantStopReason: listStopExhausted},
		{name: "missing body", authorizeFirst: true, resources: 60, missing: true, wantRequested: 60, wantConsumed: 59, wantReturned: 59, wantUnused: 1, wantStopReason: listStopExhausted},
		{name: "failed batch", authorizeFirst: true, resources: 60, failFrom: 1, wantRequested: 50, wantStopReason: listStopError},
		{name: "failed second batch", authorizeFirst: true, resources: 60, failFrom: 2, wantRequested: 60, wantConsumed: 50, wantStopReason: listStopError},
		{name: "byte and count limit", authorizeFirst: true, maxPageBytes: 1, limit: 1, resources: 2, wantRequested: 1, wantConsumed: 1, wantReturned: 1, wantStopReason: listStopByteLimit},
		{name: "oversized last body exhausted", authorizeFirst: true, maxPageBytes: 1, resources: 1, wantRequested: 1, wantConsumed: 1, wantReturned: 1, wantStopReason: listStopExhausted},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := setupBadgerKV(t)
			if tc.missing {
				store = &batchBodyMissingKV{KV: store, nameMatch: "resource-000"}
			}
			if tc.failFrom != 0 {
				store = &failDataBatchGetsKV{KV: store, failFrom: tc.failFrom, err: errors.New("body read failed")}
			}
			backend := setupTestStorageBackend(t, withKV(store))
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{
				Type: authlib.TypeUser, UserID: 123, UserUID: "u123", Namespace: appsNamespace.Namespace,
			})
			access := newNamespaceRecordingAccessClient()
			for i := range tc.resources {
				name := fmt.Sprintf("resource-%03d", i)
				seedResource(t, backend, ctx, name, "")
				if tc.denied {
					access.denied[name] = true
				}
			}
			reg := prometheus.NewPedanticRegistry()
			metrics := ProvideStorageMetrics(reg)
			srv, err := NewUninitializedResourceServer(ResourceServerOptions{
				Backend: backend, StorageMetrics: metrics, AccessClient: access,
				AuthorizeBeforeFetchEnabled: tc.authorizeFirst, MaxPageSizeBytes: tc.maxPageBytes,
			})
			require.NoError(t, err)
			t.Cleanup(srv.cancel)

			req := appsCollectionRequest(false)
			req.Limit = tc.limit
			rsp, err := srv.List(ctx, req)
			require.NoError(t, err)
			if tc.wantStopReason == listStopError {
				require.NotNil(t, rsp.Error)
			} else {
				require.Nil(t, rsp.Error)
				require.Len(t, rsp.Items, tc.wantReturned)
			}

			path := listPathStoreFetchFirst
			if tc.authorizeFirst {
				path = listPathStoreAuthorizeFirst
			}
			labels := []string{path, tc.wantStopReason}
			require.Equal(t, float64(tc.wantRequested), testutil.ToFloat64(metrics.ListBodyKeysRequested.WithLabelValues(labels...)))
			require.Equal(t, float64(tc.wantConsumed), testutil.ToFloat64(metrics.ListBodiesConsumed.WithLabelValues(labels...)))
			require.Equal(t, float64(tc.wantReturned), testutil.ToFloat64(metrics.ListItemsReturned.WithLabelValues(labels...)))
			var metric dto.Metric
			require.NoError(t, metrics.ListUnusedBodyRequests.WithLabelValues(labels...).(prometheus.Metric).Write(&metric))
			if tc.wantStopReason == listStopError {
				require.Zero(t, metric.GetHistogram().GetSampleCount(), "failed lists must not be classified as pagination waste")
			} else {
				require.Equal(t, uint64(1), metric.GetHistogram().GetSampleCount())
				require.Equal(t, float64(tc.wantUnused), metric.GetHistogram().GetSampleSum())
			}
			_, err = reg.Gather()
			require.NoError(t, err)
		})
	}
}

func TestServerListKeysOnlyDoesNotRecordBodyMetrics(t *testing.T) {
	for _, authorizeFirst := range []bool{false, true} {
		t.Run(fmt.Sprintf("authorize first %t", authorizeFirst), func(t *testing.T) {
			srv, ctx := newKeysOnlyTestServer(t, authorizeFirst)
			metrics := ProvideStorageMetrics(prometheus.NewRegistry())
			srv.storageMetrics = metrics
			seedPlaylist(t, srv, ctx, "default", "aaa")
			rsp, err := srv.List(ctx, &resourcepb.ListRequest{
				Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Group: "playlist.grafana.app", Resource: "playlists", Namespace: "default",
				}},
				KeysOnly: true,
			})
			require.NoError(t, err)
			require.Nil(t, rsp.Error)
			require.Len(t, rsp.Items, 1)
			require.Zero(t, testutil.CollectAndCount(metrics.ListUnusedBodyRequests))
			require.Zero(t, testutil.CollectAndCount(metrics.ListBodyKeysRequested))
		})
	}
}

func TestDataStoreListBodyStatsAreLazyAndRequestScoped(t *testing.T) {
	ds := newDataStore(setupBadgerKV(t), nil)
	keys := make([]DataKey, dataBatchSize+10)
	for i := range keys {
		keys[i] = DataKey{
			Group: "apps", Resource: "resources", Namespace: "default", Name: fmt.Sprintf("resource-%03d", i),
			ResourceVersion: int64(i + 1), Action: DataActionCreated,
		}
		require.NoError(t, ds.Save(t.Context(), keys[i], bytes.NewBufferString("body")))
	}
	for _, tc := range []struct {
		stopAfter     int
		wantRequested int
	}{
		{stopAfter: 1, wantRequested: dataBatchSize},
		{stopAfter: dataBatchSize + 1, wantRequested: len(keys)},
		{stopAfter: len(keys), wantRequested: len(keys)},
	} {
		t.Run(fmt.Sprintf("consume %d", tc.stopAfter), func(t *testing.T) {
			ctx, stats := withListBodyStats(t.Context())
			values := ds.BatchGet(ctx, keys)
			require.Zero(t, stats.bodyKeysRequested)
			require.Zero(t, stats.bodiesConsumed)
			consumed := 0
			for value, err := range values {
				require.NoError(t, err)
				require.NoError(t, value.Value.Close())
				consumed++
				if consumed == tc.stopAfter {
					break
				}
			}
			require.Equal(t, tc.wantRequested, stats.bodyKeysRequested)
			require.Equal(t, tc.stopAfter, stats.bodiesConsumed)
			_, nextRequest := withListBodyStats(ctx)
			require.Zero(t, nextRequest.bodyKeysRequested)
			require.Zero(t, nextRequest.bodiesConsumed)
		})
	}
}

func TestRecordListBodyStatsAnnotatesSpan(t *testing.T) {
	for _, failed := range []bool{false, true} {
		t.Run(fmt.Sprintf("failed %t", failed), func(t *testing.T) {
			recorder := tracetest.NewSpanRecorder()
			provider := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(recorder))
			t.Cleanup(func() { require.NoError(t, provider.Shutdown(context.Background())) })
			_, span := provider.Tracer("test").Start(t.Context(), "list")
			stats := &listBodyStats{supported: true, bodyKeysRequested: 50, bodiesConsumed: 3, stopReason: listStopByteLimit}
			rsp := &resourcepb.ListResponse{Items: []*resourcepb.ResourceWrapper{{}, {}, {}}}
			if failed {
				rsp.Error = &resourcepb.ErrorResult{Code: 500, Message: "read failed"}
			}
			(&server{}).recordListBodyStats(span, stats, listPathStoreAuthorizeFirst, rsp, nil)
			span.End()
			spans := recorder.Ended()
			require.Len(t, spans, 1)
			attrs := map[string]any{}
			for _, attr := range spans[0].Attributes() {
				attrs[string(attr.Key)] = attr.Value.AsInterface()
			}
			wantReason := listStopByteLimit
			if failed {
				wantReason = listStopError
			}
			require.Equal(t, map[string]any{
				"list.body_keys_requested": int64(50), "list.bodies_consumed": int64(3), "list.stop_reason": wantReason,
			}, attrs)
		})
	}
}
