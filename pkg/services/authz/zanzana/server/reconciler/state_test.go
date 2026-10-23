package reconciler

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

// fakeStateStore is an in-memory StateStore with optional error injection.
type fakeStateStore struct {
	mu     sync.Mutex
	values map[string]string
	getErr error
	setErr error
	delErr error
}

func newFakeStateStore() *fakeStateStore {
	return &fakeStateStore{values: map[string]string{}}
}

func (f *fakeStateStore) Get(_ context.Context, key string) (string, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.getErr != nil {
		return "", false, f.getErr
	}
	v, ok := f.values[key]
	return v, ok, nil
}

func (f *fakeStateStore) Set(_ context.Context, key string, value string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.setErr != nil {
		return f.setErr
	}
	f.values[key] = value
	return nil
}

func (f *fakeStateStore) Del(_ context.Context, key string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.delErr != nil {
		return f.delErr
	}
	delete(f.values, key)
	return nil
}

func (f *fakeStateStore) has(key string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	_, ok := f.values[key]
	return ok
}

func (f *fakeStateStore) state(t *testing.T, key string) namespaceState {
	t.Helper()
	f.mu.Lock()
	defer f.mu.Unlock()
	raw, ok := f.values[key]
	require.True(t, ok, "no reconciliation state recorded for %s", key)
	var state namespaceState
	require.NoError(t, json.Unmarshal([]byte(raw), &state))
	return state
}

func (f *fakeStateStore) record(t *testing.T, key string, state namespaceState) {
	t.Helper()
	raw, err := json.Marshal(state)
	require.NoError(t, err)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.values[key] = string(raw)
}

func newReconcilerWithState(srv *stubServer, cf resources.ClientFactory, ss StateStore) *Reconciler {
	r := newReconcilerForTest(srv, cf)
	r.stateStore = ss
	return r
}

func TestEnsureNamespace_ReconcilesStoreWithoutRecord(t *testing.T) {
	// The regression this state exists for: the user and org mutation hooks
	// create a store on first login, so a store can exist for a namespace whose
	// role bindings were never computed. With no record, EnsureNamespace must
	// reconcile rather than trust the store's existence.
	//
	// notFoundClientFactory drives reconcileNamespace into its "namespace
	// deleted" branch, so reaching it is observable through DeleteStore.
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "hooked-ns"}}}
	r := newReconcilerWithState(srv, notFoundClientFactory{}, newFakeStateStore())

	err := r.EnsureNamespace(context.Background(), "hooked-ns")
	require.ErrorContains(t, err, "store disappeared during reconciliation")

	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load(), "namespace with no record should be reconciled")
	_, cached := r.ensuredNamespaces.Load("hooked-ns")
	assert.False(t, cached)
}

func TestEnsureNamespace_SkipsReconcileOnMatchingRecord(t *testing.T) {
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "done-ns"}}}
	state := newFakeStateStore()
	state.record(t, "done-ns", namespaceState{StoreID: "store-1", Version: stateVersion})
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	require.NoError(t, r.EnsureNamespace(context.Background(), "done-ns"))

	assert.Equal(t, int32(0), srv.deleteStoreCalls.Load(), "reconciled namespace should not be reconciled again")
	_, cached := r.ensuredNamespaces.Load("done-ns")
	assert.True(t, cached)
}

func TestEnsureNamespace_ReconcilesWhenRecordNamesAnotherStore(t *testing.T) {
	// The record lives in Grafana's database and the tuples in Zanzana's, so a
	// rebuilt Zanzana store leaves a record naming a store that no longer
	// exists. The store ID mismatch has to invalidate it.
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-2", Name: "rebuilt-ns"}}}
	state := newFakeStateStore()
	state.record(t, "rebuilt-ns", namespaceState{StoreID: "store-1", Version: stateVersion})
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	require.ErrorContains(t, r.EnsureNamespace(context.Background(), "rebuilt-ns"), "store disappeared")
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}

func TestEnsureNamespace_ReconcilesOnOutdatedRecordVersion(t *testing.T) {
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "old-ns"}}}
	state := newFakeStateStore()
	state.record(t, "old-ns", namespaceState{StoreID: "store-1", Version: stateVersion - 1})
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	require.ErrorContains(t, r.EnsureNamespace(context.Background(), "old-ns"), "store disappeared")
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}

func TestEnsureNamespace_SkipsReconcileOnNewerRecordVersion(t *testing.T) {
	// A record written by a newer binary mid-rollout must not be reverted to
	// this one's computation.
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "ahead-ns"}}}
	state := newFakeStateStore()
	state.record(t, "ahead-ns", namespaceState{StoreID: "store-1", Version: stateVersion + 1})
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	require.NoError(t, r.EnsureNamespace(context.Background(), "ahead-ns"))

	assert.Equal(t, int32(0), srv.deleteStoreCalls.Load())
	assert.Equal(t, namespaceState{StoreID: "store-1", Version: stateVersion + 1}, state.state(t, "ahead-ns"),
		"the newer record should be left as it is")
}

func TestEnsureNamespace_ReconcilesWhenStateStoreFails(t *testing.T) {
	// An unreadable record must not be read as "already reconciled".
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "broken-ns"}}}
	state := newFakeStateStore()
	state.getErr = errors.New("kv unavailable")
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	require.ErrorContains(t, r.EnsureNamespace(context.Background(), "broken-ns"), "store disappeared")
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}

func TestEnsureNamespace_ReconcilesOnUndecodableRecord(t *testing.T) {
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "garbage-ns"}}}
	state := newFakeStateStore()
	require.NoError(t, state.Set(context.Background(), "garbage-ns", "not json"))
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	require.ErrorContains(t, r.EnsureNamespace(context.Background(), "garbage-ns"), "store disappeared")
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}

func TestMarkReconciled_RecordsCurrentStore(t *testing.T) {
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "ns-1", ModelID: "model-1"}}}
	state := newFakeStateStore()
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	r.markReconciled(context.Background(), "ns-1")

	recorded := state.state(t, "ns-1")
	assert.Equal(t, "store-1", recorded.StoreID)
	assert.Equal(t, "model-1", recorded.ModelID)
	assert.Equal(t, stateVersion, recorded.Version)
	assert.NotZero(t, recorded.ReconciledAt)
}

func TestMarkReconciled_SkipsWhenStoreIsGone(t *testing.T) {
	srv := &stubServer{}
	state := newFakeStateStore()
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	r.markReconciled(context.Background(), "missing-ns")

	assert.False(t, state.has("missing-ns"), "no record should be written without a store to name")
}

func TestReconcileNamespace_ClearsRecordOnNotFound(t *testing.T) {
	// A namespace that disappears has its store deleted, so its record must go
	// too — otherwise a namespace recreated under the same name would inherit a
	// record for tuples that no longer exist.
	srv := &stubServer{}
	state := newFakeStateStore()
	state.record(t, "gone-ns", namespaceState{StoreID: "store-1", Version: stateVersion})
	r := newReconcilerWithState(srv, notFoundClientFactory{}, state)

	_, err := r.reconcileNamespace(context.Background(), "gone-ns")
	require.NoError(t, err)

	assert.False(t, state.has("gone-ns"))
	assert.Equal(t, int32(1), srv.deleteStoreCalls.Load())
}
