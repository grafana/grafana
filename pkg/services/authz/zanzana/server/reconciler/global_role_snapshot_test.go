package reconciler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"testing"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	clienttesting "k8s.io/client-go/testing"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func TestGlobalRoleSnapshot_EmptySnapshotSurvivesRestart(t *testing.T) {
	ctx := context.Background()
	state := newFakeStateStore()
	seed := newReconcilerWithState(&stubServer{}, fakeAnonClientFactory{dyn: newGlobalRoleTestClient()}, state)
	seed.queueAllNamespaces(ctx)
	require.Len(t, state.snapshots, 1)
	before := maps.Clone(state.snapshots)

	dyn := newGlobalRoleTestClient()
	dyn.PrependReactor("list", "globalroles", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, errors.New("global roles unavailable")
	})
	restarted := newReconcilerWithState(&stubServer{listAllStoresResults: []zanzana.StoreInfo{{Name: "test-ns"}}}, fakeAnonClientFactory{dyn: dyn}, state)
	restarted.workQueue = make(chan string, 1)
	restarted.queueAllNamespaces(ctx)
	require.Len(t, restarted.workQueue, 1)
	require.NotNil(t, restarted.getGlobalRolePerms())
	require.Empty(t, restarted.getGlobalRolePerms())
	require.Equal(t, before, state.snapshots, "fallback must not refresh the persisted timestamp")
}

func TestGlobalRoleSnapshot_InvalidSnapshotDoesNotMutateStore(t *testing.T) {
	for _, tc := range []struct {
		name    string
		change  func(*globalRoleSnapshot)
		raw     string
		readErr error
	}{
		{name: "corrupt JSON", raw: "{"},
		{name: "missing permissions", change: func(s *globalRoleSnapshot) { s.Permissions = nil }},
		{name: "missing timestamp", change: func(s *globalRoleSnapshot) { s.FetchedAt = 0 }},
		{name: "newer format", change: func(s *globalRoleSnapshot) { s.FormatVersion++ }},
		{name: "older computation", change: func(s *globalRoleSnapshot) { s.StateVersion-- }},
		{name: "newer computation", change: func(s *globalRoleSnapshot) { s.StateVersion++ }},
		{name: "null permission", change: func(s *globalRoleSnapshot) { s.Permissions["role"] = []*authzextv1.RolePermission{nil} }},
		{name: "empty action", change: func(s *globalRoleSnapshot) { s.Permissions["role"] = []*authzextv1.RolePermission{{}} }},
		{name: "empty role name", change: func(s *globalRoleSnapshot) { s.Permissions[""] = nil }},
		{name: "read failure", readErr: errors.New("database unavailable")},
	} {
		t.Run(tc.name, func(t *testing.T) {
			state := newFakeStateStore()
			snapshot := globalRoleSnapshot{FormatVersion: globalRoleSnapshotVersion, StateVersion: stateVersion, FetchedAt: time.Now().Unix(), Permissions: map[string][]*authzextv1.RolePermission{}}
			if tc.change != nil {
				tc.change(&snapshot)
			}
			raw, err := json.Marshal(snapshot)
			require.NoError(t, err)
			if tc.raw != "" {
				raw = []byte(tc.raw)
			}
			state.snapshots[globalRoleSnapshotKey()] = string(raw)
			state.getErr = tc.readErr
			dyn := newGlobalRoleTestClient()
			fetchErr := errors.New("global roles unavailable")
			dyn.PrependReactor("list", "globalroles", func(clienttesting.Action) (bool, runtime.Object, error) {
				return true, nil, fetchErr
			})
			srv := &globalRoleTestServer{stubServer: &stubServer{getStoreResults: []*zanzana.StoreInfo{{ID: "store-1", Name: "test-ns"}}}}
			r := newReconcilerWithState(srv.stubServer, fakeAnonClientFactory{dyn: dyn}, state)
			r.server = srv
			r.cfg.CRDs = nil
			require.ErrorIs(t, r.EnsureNamespace(context.Background(), "test-ns"), fetchErr)
			require.Zero(t, srv.writes)
			require.Zero(t, srv.deleteStoreCalls.Load())
			require.False(t, state.has("test-ns"))
		})
	}
}

func TestGlobalRoleSnapshot_RefreshAndVersionIsolation(t *testing.T) {
	ctx := context.Background()
	state := newFakeStateStore()
	otherKey := fmt.Sprintf("snapshot-v%d-state%d", globalRoleSnapshotVersion, stateVersion+1)
	state.snapshots[otherKey] = "another version's snapshot"
	dyn := newGlobalRoleTestClient(snapshotGlobalRole())
	r := newReconcilerWithState(&stubServer{}, fakeAnonClientFactory{dyn: dyn}, state)
	r.queueAllNamespaces(ctx)
	before := maps.Clone(state.snapshots)
	require.Len(t, before, 2)

	fetchErr := errors.New("global roles unavailable")
	dyn.PrependReactor("list", "globalroles", func(clienttesting.Action) (bool, runtime.Object, error) {
		return true, nil, fetchErr
	})
	r.queueAllNamespaces(ctx)
	require.Equal(t, before, state.snapshots)
	require.NotEmpty(t, r.getGlobalRolePerms())

	// A recovered API with no GlobalRoles must replace, not retain, the previous permissions.
	r.clientFactory = fakeAnonClientFactory{dyn: newGlobalRoleTestClient()}
	r.queueAllNamespaces(ctx)
	require.NotNil(t, r.getGlobalRolePerms())
	require.Empty(t, r.getGlobalRolePerms())
	snapshot, err := r.readGlobalRoleSnapshot(ctx)
	require.NoError(t, err)
	require.NotNil(t, snapshot)
	require.Empty(t, snapshot.Permissions)
	require.Equal(t, before[otherKey], state.snapshots[otherKey])
}

func TestGlobalRoleSnapshot_WriteFailureDoesNotBlockLivePermissions(t *testing.T) {
	state := newFakeStateStore()
	state.setErr = errors.New("database unavailable")
	r := newReconcilerWithState(&stubServer{listAllStoresResults: []zanzana.StoreInfo{{Name: "test-ns"}}}, fakeAnonClientFactory{dyn: newGlobalRoleTestClient(snapshotGlobalRole())}, state)
	r.workQueue = make(chan string, 1)
	r.queueAllNamespaces(context.Background())
	require.Len(t, r.workQueue, 1)
	require.NotEmpty(t, r.getGlobalRolePerms())
	require.Empty(t, state.snapshots)
}

func snapshotGlobalRole() *unstructured.Unstructured {
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "iam.grafana.app/v0alpha1", "kind": "GlobalRole",
		"metadata": map[string]any{"name": "global-reader"},
		"spec":     map[string]any{"permissions": []any{map[string]any{"action": "dashboards:read", "scope": "dashboards:uid:d1"}}},
	}}
}

func TestGlobalRoleSnapshot_RestartPreservesPermissionsAndAppliesRevocations(t *testing.T) {
	for _, inline := range []bool{false, true} {
		name := "background with matching completion record"
		if inline {
			name = "inline with mismatched completion record"
		}
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			state := newFakeStateStore()
			seed := newReconcilerWithState(&stubServer{}, fakeAnonClientFactory{dyn: newGlobalRoleTestClient(snapshotGlobalRole())}, state)
			seed.queueAllNamespaces(ctx)
			require.Len(t, state.snapshots, 1, "a successful fetch must persist the snapshot")

			store := &zanzana.StoreInfo{ID: "store-1", Name: "test-ns"}
			recordID := store.ID
			if inline {
				recordID = "other-store"
			}
			state.record(t, store.Name, namespaceState{StoreID: recordID, Version: stateVersion})
			srv := &globalRoleTestServer{stubServer: &stubServer{
				getStoreResults:      []*zanzana.StoreInfo{store, store, store},
				listAllStoresResults: []zanzana.StoreInfo{*store},
			}}
			perms := []*authzextv1.RolePermission{{Action: "dashboards:read", Scope: "dashboards:uid:d1"}}
			globalTuples, err := zanzana.RoleToTuples("global-reader", perms)
			require.NoError(t, err)
			require.NotEmpty(t, globalTuples)
			for _, tuple := range globalTuples {
				srv.tuples = append(srv.tuples, toTuple(tuple))
			}
			revokedTuples, err := zanzana.RoleToTuples("deleted-local-role", perms)
			require.NoError(t, err)
			require.NotEmpty(t, revokedTuples)
			wantDeletes := make([]*openfgav1.TupleKeyWithoutCondition, 0, len(revokedTuples))
			for _, tuple := range revokedTuples {
				srv.tuples = append(srv.tuples, toTuple(tuple))
				wantDeletes = append(wantDeletes, &openfgav1.TupleKeyWithoutCondition{User: tuple.User, Relation: tuple.Relation, Object: tuple.Object})
			}
			dyn := newGlobalRoleTestClient()
			dyn.PrependReactor("list", "globalroles", func(clienttesting.Action) (bool, runtime.Object, error) {
				return true, nil, errors.New("global roles unavailable")
			})
			restarted := newReconcilerWithState(srv.stubServer, fakeAnonClientFactory{dyn: dyn}, state)
			restarted.server = srv
			restarted.cfg.CRDs = []schema.GroupVersionResource{iamv0.RoleInfo.GroupVersionResource()}
			restarted.workQueue = make(chan string, 1)
			require.Nil(t, restarted.getGlobalRolePerms())

			if inline {
				require.NoError(t, restarted.EnsureNamespace(ctx, store.Name))
			} else {
				restarted.queueAllNamespaces(ctx)
				require.Len(t, restarted.workQueue, 1)
				restarted.runNamespaceReconciliation(ctx, <-restarted.workQueue, 0)
			}
			require.Empty(t, srv.added)
			require.ElementsMatch(t, wantDeletes, srv.deleted)
			require.Equal(t, store.ID, state.state(t, store.Name).StoreID)
		})
	}
}
