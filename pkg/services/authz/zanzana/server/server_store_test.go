package server

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func TestGetStore_Cache(t *testing.T) {
	srv := setupOpenFGAServer(t)
	ctx := context.Background()
	testNamespace := "test-cache-namespace"

	// 1. Create the store first so it exists in OpenFGA
	store, err := srv.GetOrCreateStore(ctx, testNamespace)
	require.NoError(t, err)
	require.NotNil(t, store)

	// 2. Clear the in-memory cache to simulate a fresh start or a different pod
	srv.storesMU.Lock()
	delete(srv.stores, testNamespace)
	srv.storesMU.Unlock()

	// 3. Call GetStore. This should trigger a ListStores call and then CACHE the result.
	store1, err := srv.GetStore(ctx, testNamespace)
	require.NoError(t, err)
	require.Equal(t, store.ID, store1.ID)

	// 4. Verify it's now in the cache
	srv.storesMU.Lock()
	info, ok := srv.stores[testNamespace]
	srv.storesMU.Unlock()
	require.True(t, ok, "Store should be in cache after GetStore call")
	require.Equal(t, store.ID, info.ID)

	// 5. Call GetStore again. This should now return from cache.
	store2, err := srv.GetStore(ctx, testNamespace)
	require.NoError(t, err)
	require.Equal(t, store.ID, store2.ID)
}

func TestGetOrCreateStore_FullFlow(t *testing.T) {
	srv := setupOpenFGAServer(t)
	ctx := context.Background()
	testNamespace := "test-full-flow-namespace"

	// 1. Call GetStore for a non-existent namespace
	_, err := srv.GetStore(ctx, testNamespace)
	require.ErrorIs(t, err, zanzana.ErrStoreNotFound)

	// 2. Call GetOrCreateStore (should create store + load model + cache)
	store, err := srv.GetOrCreateStore(ctx, testNamespace)
	require.NoError(t, err)
	require.NotEmpty(t, store.ID)
	require.NotEmpty(t, store.ModelID)

	// 3. Verify cache is fully populated
	srv.storesMU.Lock()
	info, ok := srv.stores[testNamespace]
	srv.storesMU.Unlock()
	require.True(t, ok)
	require.Equal(t, store.ID, info.ID)
	require.Equal(t, store.ModelID, info.ModelID)

	// 4. Simulate cache having only ID/Name (e.g. from a previous GetStore call)
	srv.storesMU.Lock()
	srv.stores[testNamespace] = zanzana.StoreInfo{ID: store.ID, Name: testNamespace}
	srv.storesMU.Unlock()

	// 5. Call GetOrCreateStore again (should lazy-load ModelID)
	store2, err := srv.GetOrCreateStore(ctx, testNamespace)
	require.NoError(t, err)
	require.Equal(t, store.ModelID, store2.ModelID)

	// 6. Verify cache is now updated with ModelID
	srv.storesMU.Lock()
	info2, ok := srv.stores[testNamespace]
	srv.storesMU.Unlock()
	require.True(t, ok)
	require.Equal(t, store.ModelID, info2.ModelID)
}
