package resource

import (
	"context"
	"iter"
	"math"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
	gocache "github.com/patrickmn/go-cache"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
)

// gcLeaseTestKV delegates persistence to Badger, with hooks to pause a scan or
// fail renewal while the collector owns its lease.
type gcLeaseTestKV struct {
	KV
	beforeKeys func(context.Context, string)
	failRenew  atomic.Bool
}

func (s *gcLeaseTestKV) Keys(ctx context.Context, section string, opts ListOptions) iter.Seq2[string, error] {
	if s.beforeKeys != nil {
		s.beforeKeys(ctx, section)
	}
	return s.KV.Keys(ctx, section, opts)
}

func (s *gcLeaseTestKV) Batch(ctx context.Context, section string, ops []kv.BatchOp) error {
	if section == kv.LeasesSection && s.failRenew.Load() {
		return kv.ErrKeyAlreadyExists
	}
	return s.KV.Batch(ctx, section, ops)
}

func newGCLeaseTestBackend(t *testing.T, store KV) *kvStorageBackend {
	t.Helper()
	manager := lease.NewManager(store, newLeaseHolder(""), "storage", nil, lease.WithGarbageCollectionDisabled)
	t.Cleanup(manager.Stop)
	return &kvStorageBackend{
		kv:                store,
		dataStore:         &dataStore{kv: store, cache: gocache.New(gocache.NoExpiration, 0)},
		leaseManager:      manager,
		log:               &logging.NoOpLogger{},
		metrics:           newKVBackendMetrics(nil),
		garbageCollection: GarbageCollectionConfig{BlobEnabled: true, MaxAge: time.Hour, BatchSize: 100},
	}
}

func TestGarbageCollectionLeaseOwnership(t *testing.T) {
	for _, dryRun := range []bool{false, true} {
		name := "delete"
		if dryRun {
			name = "dry run"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				store := setupBadgerKV(t)
				wrapped := &gcLeaseTestKV{KV: store}
				first := newGCLeaseTestBackend(t, wrapped)
				second := newGCLeaseTestBackend(t, store)
				first.garbageCollection.DryRun = dryRun
				second.garbageCollection.DryRun = dryRun
				blob := saveTestBlob(t, store, "00000000-0000-7000-8000-000000000000")
				data := DataKey{Group: "group", Resource: "resource", Namespace: "namespace", Name: "name", ResourceVersion: 1, Action: DataActionDeleted}
				require.NoError(t, first.dataStore.Save(t.Context(), data, strings.NewReader(`{}`)))
				seen := map[string]bool{}
				wrapped.beforeKeys = func(ctx context.Context, section string) {
					if (section != dataSection && section != kv.BlobDataSection) || seen[section] {
						return
					}
					seen[section] = true
					// A pass outliving the default TTL must retain ownership through
					// both resource collection and the deferred blob collection.
					synctest.Sleep(30 * time.Second)
					require.NoError(t, ctx.Err())
					second.runGarbageCollectionWithLease(t.Context(), math.MaxInt64)
					require.Nil(t, second.blobGC, "the competing replica must skip the entire pass")
					_, err := second.leaseManager.Acquire(t.Context(), "garbage-collection")
					require.ErrorIs(t, err, lease.ErrLeaseAlreadyHeld)
				}
				first.runGarbageCollectionWithLease(t.Context(), math.MaxInt64)
				require.True(t, seen[dataSection])
				require.True(t, seen[kv.BlobDataSection])
				for section, key := range map[string]string{dataSection: data.String(), kv.BlobDataSection: blob} {
					reader, err := store.Get(t.Context(), section, key)
					if dryRun {
						require.NoError(t, err)
						require.NoError(t, reader.Close())
					} else {
						require.ErrorIs(t, err, kv.ErrNotFound, section)
					}
				}
				second.runGarbageCollectionWithLease(t.Context(), math.MaxInt64)
				require.NotNil(t, second.blobGC, "another replica can take over after release")
			})
		})
	}
}

func TestGarbageCollectionLeaseCancellation(t *testing.T) {
	for _, name := range []string{"shutdown", "renewal failure", "acquisition failure"} {
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				store := setupBadgerKV(t)
				wrapped := &gcLeaseTestKV{KV: store}
				backend := newGCLeaseTestBackend(t, wrapped)
				blob := saveTestBlob(t, store, "00000000-0000-7000-8000-000000000000")
				ctx, cancel := context.WithCancel(t.Context())
				defer cancel()
				wrapped.beforeKeys = func(passCtx context.Context, section string) {
					if section != dataSection {
						return
					}
					if name == "renewal failure" {
						wrapped.failRenew.Store(true)
					} else {
						cancel()
					}
					<-passCtx.Done()
				}
				wrapped.failRenew.Store(name == "acquisition failure")
				backend.runGarbageCollectionWithLease(ctx, math.MaxInt64)
				require.Nil(t, backend.blobGC, "lease failure or cancellation must skip the blob pass")
				reader, err := store.Get(t.Context(), kv.BlobDataSection, blob)
				require.NoError(t, err)
				require.NoError(t, reader.Close())
				wrapped.failRenew.Store(false)
				wrapped.beforeKeys = nil
				backend.runGarbageCollectionWithLease(t.Context(), math.MaxInt64)
				_, err = store.Get(t.Context(), kv.BlobDataSection, blob)
				require.ErrorIs(t, err, kv.ErrNotFound, "a later pass can collect after cancellation")
			})
		})
	}
}
