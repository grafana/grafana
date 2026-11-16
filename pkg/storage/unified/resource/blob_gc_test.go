package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/grafana/grafana/pkg/apimachinery/utils"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestResourceReferencesBlob(t *testing.T) {
	for _, tc := range []struct {
		name, value   string
		live, failure bool
	}{
		{name: "snapshot", value: `{"blobs":{"dashboard":{"uid":"blob"}}}`, live: true},
		{name: "multiple references", value: `{"blobs":{"other":{"uid":"other"},"dashboard":{"uid":"blob"}}}`, live: true},
		{name: "annotation", value: `{"metadata":{"annotations":{"grafana.app/blob":"blob; size=12"}}}`, live: true},
		{name: "different uid", value: `{"blobs":{"dashboard":{"uid":"other"}}}`},
		{name: "inline snapshot", value: `{"spec":{"dashboard":{}}}`},
		{name: "malformed", value: `{`, failure: true},
		{name: "malformed references", value: `{"blobs":{"dashboard":"blob"}}`, failure: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			live, err := ResourceReferencesBlob([]byte(tc.value), "blob")
			require.Equal(t, tc.failure, err != nil)
			require.Equal(t, tc.live, live)
		})
	}
}

func TestBlobGarbageCollector(t *testing.T) {
	for _, scenario := range []string{"orphan", "referenced", "dry run", "read error", "reference appears", "restart"} {
		t.Run(scenario, func(t *testing.T) {
			store := setupSqlKV(t)
			key := kv.BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap", UID: "blob"}
			writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
			require.NoError(t, err)
			_, err = writer.Write(append(kv.EncodeBlobValueHeader("text/plain"), []byte("payload")...))
			require.NoError(t, err)
			require.NoError(t, writer.Close())
			gc := NewBlobGarbageCollector(store, 100, 0)
			now := time.Now()
			live := scenario == "referenced"
			var readErr error
			referenced := func(context.Context, kv.BlobKey) (bool, error) { return live, readErr }
			count, err := gc.Collect(t.Context(), now, time.Hour, false, referenced)
			require.NoError(t, err)
			require.Zero(t, count)
			count, err = gc.Collect(t.Context(), now.Add(time.Minute), time.Hour, false, referenced)
			require.NoError(t, err)
			require.Zero(t, count)
			switch scenario {
			case "read error":
				readErr = errors.New("unavailable")
			case "reference appears":
				live = true
			case "restart":
				gc = NewBlobGarbageCollector(store, 100, 0)
			}
			count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, scenario == "dry run", referenced)
			require.Equal(t, scenario == "read error", err != nil)
			expectedCount := 0
			if scenario == "orphan" || scenario == "dry run" || scenario == "restart" {
				expectedCount = 1
			}
			require.Equal(t, expectedCount, count)
			reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
			if scenario == "orphan" || scenario == "restart" {
				require.ErrorIs(t, err, kv.ErrNotFound)
			} else {
				require.NoError(t, err)
				require.NoError(t, reader.Close())
			}
		})
	}
}

func TestBlobGCPagedKeys(t *testing.T) {
	store := setupSqlKV(t)
	base := kv.BlobKey{Group: "group", Resource: "resource", Name: "name", UID: "a"}
	for _, uid := range []string{"a", "a-long", "b"} {
		key := base
		key.UID = uid
		if uid == "a" {
			key.Name = "z-last-resource-first-uuid"
		}
		writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
		require.NoError(t, err)
		_, err = writer.Write(append(kv.EncodeBlobValueHeader("text/plain"), []byte("payload")...))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
	}
	now := time.Now()
	gc := NewBlobGarbageCollector(store, 1, 0)
	live := func(_ context.Context, key kv.BlobKey) (bool, error) { return key.UID == "b", nil }
	count, err := gc.Collect(t.Context(), now, time.Hour, false, live)
	require.NoError(t, err)
	require.Zero(t, count)
	gc = NewBlobGarbageCollector(store, 1, 0)
	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, true, live)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, live)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	key := base
	key.UID = "b"
	reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	require.NoError(t, reader.Close())
}

func TestKVBlobGCOptInAndDryRun(t *testing.T) {
	b := setupTestStorageBackend(t)
	b.kv = setupSqlKV(t)
	b.dataStore = newDataStore(b.kv)
	key := kv.BlobKey{Group: "group", Resource: "resource", Namespace: "default", Name: "snap", UID: "unreferenced"}
	writer, err := b.kv.Save(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	_, err = writer.Write(append(kv.EncodeBlobValueHeader("image/png"), []byte("image")...))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	b.garbageCollection.MaxAge = time.Nanosecond
	b.runGarbageCollection(t.Context(), time.Now().UnixMicro())
	require.Nil(t, b.blobGC)

	b.garbageCollection.BlobEnabled = true
	b.garbageCollection.BlobDryRun = true
	b.collectBlobs(t.Context())
	b.collectBlobs(t.Context())
	reader, err := b.kv.Get(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	require.NoError(t, reader.Close())

	b.garbageCollection.BlobDryRun = false
	b.collectBlobs(t.Context())
	_, err = b.kv.Get(t.Context(), kv.BlobDataSection, key.String())
	require.ErrorIs(t, err, kv.ErrNotFound)
}

type blobGCShutdownStore struct {
	KV
	keys   func(context.Context) iter.Seq2[string, error]
	delete func() error
}

func (s blobGCShutdownStore) Keys(ctx context.Context, section string, _ kv.ListOptions) iter.Seq2[string, error] {
	if section != kv.BlobDataSection {
		return func(func(string, error) bool) {}
	}
	return s.keys(ctx)
}

func (s blobGCShutdownStore) FirstUnused(context.Context, string, time.Time) (time.Time, error) {
	return time.Now().Add(-2 * time.Hour), nil
}

func (s blobGCShutdownStore) Delete(context.Context, string, string) error {
	if s.delete != nil {
		return s.delete()
	}
	return nil
}

type blobGCShutdownLogger struct {
	logging.NoOpLogger
	infos  []string
	errors []string
}

func (l *blobGCShutdownLogger) Info(msg string, _ ...any)  { l.infos = append(l.infos, msg) }
func (l *blobGCShutdownLogger) Error(msg string, _ ...any) { l.errors = append(l.errors, msg) }

func TestKVBlobGCShutdown(t *testing.T) {
	for _, scenario := range []string{"already canceled", "canceled during scan", "grpc canceled during scan", "storage error", "storage error during cancellation", "remote cancellation", "success"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			if scenario == "already canceled" {
				cancel()
			}
			calls := 0
			store := blobGCShutdownStore{keys: func(ctx context.Context) iter.Seq2[string, error] {
				calls++
				return func(yield func(string, error) bool) {
					switch scenario {
					case "already canceled":
						yield("", ctx.Err())
					case "canceled during scan":
						cancel()
						yield("", ctx.Err())
					case "grpc canceled during scan":
						cancel()
						yield("", status.Error(codes.Canceled, "context canceled"))
					case "storage error":
						yield("", errors.New("storage unavailable"))
					case "storage error during cancellation":
						cancel()
						yield("", errors.New("storage unavailable"))
					case "remote cancellation":
						yield("", status.Error(codes.Canceled, "remote canceled"))
					}
				}
			}}
			logger := &blobGCShutdownLogger{}
			metrics := NewBlobGCMetricsIfEnabled(prometheus.NewRegistry(), "kv", true)
			metrics.Candidates.Set(7)
			b := &kvStorageBackend{
				blobGC:        NewBlobGarbageCollector(store, 100, 0),
				blobGCMetrics: metrics,
				log:           logger,
			}
			b.garbageCollection.MaxAge = time.Hour
			b.garbageCollection.BlobDryRun = true
			b.collectBlobs(ctx)

			if scenario == "already canceled" {
				require.Zero(t, calls, "must not start a scan with a canceled context")
			} else {
				require.Equal(t, 1, calls)
			}
			switch scenario {
			case "storage error", "storage error during cancellation", "remote cancellation":
				require.Equal(t, []string{"blob garbage collection failed"}, logger.errors)
				require.Empty(t, logger.infos)
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.Errors))
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.Runs))
			case "success":
				require.Empty(t, logger.errors)
				require.Equal(t, []string{"blob garbage collection finished"}, logger.infos)
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.Runs))
				require.Zero(t, testutil.ToFloat64(metrics.Candidates))
			default:
				require.Empty(t, logger.errors)
				require.Empty(t, logger.infos)
				require.Zero(t, testutil.ToFloat64(metrics.Errors))
				if scenario == "already canceled" {
					require.Zero(t, testutil.ToFloat64(metrics.Runs))
				} else {
					require.Equal(t, float64(1), testutil.ToFloat64(metrics.Runs))
				}
			}
			if scenario != "success" {
				require.Equal(t, float64(7), testutil.ToFloat64(metrics.Candidates))
			}
		})
	}
}

func TestKVBlobGCPartialProgress(t *testing.T) {
	for _, scenario := range []string{"cancellation", "storage error with cancellation"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			key := kv.BlobKey{Group: "group", Resource: "resource", Namespace: "default", Name: "snap", UID: "blob"}.String()
			store := blobGCShutdownStore{keys: func(context.Context) iter.Seq2[string, error] {
				return func(yield func(string, error) bool) {
					if !yield(key, nil) {
						return
					}
					cancel()
					if scenario == "cancellation" {
						yield("", ctx.Err())
					} else {
						yield("", fmt.Errorf("scan: %w", errors.Join(ctx.Err(), errors.New("storage unavailable"))))
					}
				}
			}}
			logger := &blobGCShutdownLogger{}
			metrics := NewBlobGCMetricsIfEnabled(prometheus.NewRegistry(), "kv", true)
			metrics.Candidates.Set(7)
			b := &kvStorageBackend{
				blobGC:        NewBlobGarbageCollector(store, 100, 0),
				blobGCMetrics: metrics,
				log:           logger,
				dataStore:     newDataStore(store),
			}
			b.garbageCollection.MaxAge = time.Hour
			b.collectBlobs(ctx)
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.Runs))
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.Deleted))
			require.Equal(t, float64(7), testutil.ToFloat64(metrics.Candidates))
			require.Empty(t, logger.infos)
			if scenario == "cancellation" {
				require.Zero(t, testutil.ToFloat64(metrics.Errors))
				require.Empty(t, logger.errors)
			} else {
				require.Equal(t, float64(1), testutil.ToFloat64(metrics.Errors))
				require.Equal(t, []string{"blob garbage collection failed"}, logger.errors)
			}
		})
	}
}

func TestKVBlobGCErrorBeforeCancellation(t *testing.T) {
	for _, scenario := range []string{"context check", "batch wait"} {
		t.Run(scenario, func(t *testing.T) {
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			storageErr := errors.New("delete failed")
			key := kv.BlobKey{Group: "group", Resource: "resource", Namespace: "default", Name: "snap", UID: "blob"}.String()
			store := blobGCShutdownStore{
				keys: func(context.Context) iter.Seq2[string, error] {
					return func(yield func(string, error) bool) {
						if !yield(key, nil) {
							return
						}
						if scenario == "batch wait" {
							time.AfterFunc(20*time.Millisecond, cancel)
						}
						yield(key, nil)
					}
				},
				delete: func() error {
					if scenario == "context check" {
						cancel()
					}
					return storageErr
				},
			}
			gc := NewBlobGarbageCollector(store, 1, 0)
			if scenario == "batch wait" {
				gc.batchWait = time.Second
			}
			logger := &blobGCShutdownLogger{}
			metrics := NewBlobGCMetricsIfEnabled(prometheus.NewRegistry(), "kv", true)
			b := &kvStorageBackend{
				blobGC: gc, blobGCMetrics: metrics, log: logger,
				dataStore: newDataStore(store),
			}
			b.garbageCollection.MaxAge = time.Hour
			b.collectBlobs(ctx)
			require.Equal(t, []string{"blob garbage collection failed"}, logger.errors)
			require.Empty(t, logger.infos)
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.Errors))
			require.Equal(t, float64(1), testutil.ToFloat64(metrics.Runs))
			require.Zero(t, testutil.ToFloat64(metrics.Deleted))

			ctx2, cancel2 := context.WithCancel(t.Context())
			defer cancel2()
			store.keys = func(context.Context) iter.Seq2[string, error] {
				return func(yield func(string, error) bool) {
					if !yield(key, nil) {
						return
					}
					if scenario == "batch wait" {
						time.AfterFunc(20*time.Millisecond, cancel2)
					}
					yield(key, nil)
				}
			}
			store.delete = func() error {
				if scenario == "context check" {
					cancel2()
				}
				return storageErr
			}
			gc = NewBlobGarbageCollector(store, 1, gc.batchWait)
			_, err := gc.Collect(ctx2, time.Now(), time.Hour, false,
				func(context.Context, kv.BlobKey) (bool, error) { return false, nil })
			require.ErrorIs(t, err, storageErr)
			require.ErrorIs(t, err, context.Canceled)
		})
	}
}

func TestBlobGCPreservesProvisioningPreviewURL(t *testing.T) {
	store := setupSqlKV(t)
	key := kv.BlobKey{Group: "provisioning.grafana.app", Resource: "repositories", Namespace: "default", Name: "repo", UID: "preview"}
	writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	_, err = writer.Write(append(kv.EncodeBlobValueHeader("image/png"), []byte("image")...))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	gc := NewBlobGarbageCollector(store, 100, 0)
	now := time.Now()
	for _, at := range []time.Time{now, now.Add(48 * time.Hour)} {
		count, err := gc.Collect(t.Context(), at, time.Hour, false, func(context.Context, kv.BlobKey) (bool, error) {
			return false, nil // URL references are not in resource history
		})
		require.NoError(t, err)
		require.Zero(t, count)
	}
	reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	require.NoError(t, reader.Close())
}

func TestCDKBlobGCStore(t *testing.T) {
	bucket, err := OpenBlobBucket(t.Context(), "mem://")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, bucket.Close()) })
	blobStore, err := NewCDKBlobSupport(t.Context(), CDKBlobSupportOptions{Bucket: bucket})
	require.NoError(t, err)
	resourceKey := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap"}
	response, err := blobStore.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{Resource: resourceKey, ContentType: "image/png", Value: []byte("image")})
	require.NoError(t, err)
	store := NewCDKBlobGCStore(bucket, "")
	gc := NewBlobGarbageCollector(store, 100, 0)
	now := time.Now()
	key := kv.BlobKey{Group: resourceKey.Group, Resource: resourceKey.Resource, Namespace: resourceKey.Namespace, Name: resourceKey.Name, UID: response.Uid}
	count, err := gc.Collect(t.Context(), now, time.Hour, false, func(_ context.Context, got kv.BlobKey) (bool, error) {
		require.Equal(t, key, got)
		return false, nil
	})
	require.NoError(t, err)
	require.Zero(t, count)
	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, func(context.Context, kv.BlobKey) (bool, error) { return false, nil })
	require.NoError(t, err)
	require.Equal(t, 1, count)
	_, err = blobStore.GetResourceBlob(t.Context(), resourceKey, &utils.BlobInfo{UID: response.Uid, MimeType: "image/png"}, true)
	require.Error(t, err)

	preview := &resourcepb.ResourceKey{Group: "provisioning.grafana.app", Resource: "repositories", Namespace: "", Name: "repo"}
	previewResponse, err := blobStore.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{Resource: preview, ContentType: "image/png", Value: []byte("preview")})
	require.NoError(t, err)
	for _, at := range []time.Time{now.Add(3 * time.Hour), now.Add(48 * time.Hour)} {
		count, err = gc.Collect(t.Context(), at, time.Hour, false, func(context.Context, kv.BlobKey) (bool, error) { return false, nil })
		require.NoError(t, err)
		require.Zero(t, count)
	}
	value, err := blobStore.GetResourceBlob(t.Context(), preview, &utils.BlobInfo{UID: previewResponse.Uid, MimeType: "image/png"}, true)
	require.NoError(t, err)
	require.Equal(t, []byte("preview"), value.Value)
}

func TestBlobReferencedPreservesHistory(t *testing.T) {
	store := setupBadgerKV(t)
	backend := &kvStorageBackend{dataStore: &dataStore{kv: store}}
	blob := kv.BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap", UID: "blob"}
	old := DataKey{Group: blob.Group, Resource: blob.Resource, Namespace: blob.Namespace, Name: blob.Name, ResourceVersion: 1, Action: DataActionCreated}
	newer := old
	newer.ResourceVersion = 2
	newer.Action = DataActionDeleted
	for _, revision := range []struct {
		key   DataKey
		value string
	}{
		{old, `{"blobs":{"dashboard":{"uid":"blob"}}}`},
		{newer, `{"metadata":{}}`},
	} {
		writer, err := store.Save(t.Context(), kv.DataSection, revision.key.String())
		require.NoError(t, err)
		_, err = writer.Write([]byte(revision.value))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
	}
	live, err := backend.blobReferenced(t.Context(), blob)
	require.NoError(t, err)
	require.True(t, live)
	require.NoError(t, store.Delete(t.Context(), kv.DataSection, old.String()))
	live, err = backend.blobReferenced(t.Context(), blob)
	require.NoError(t, err)
	require.False(t, live)
}
