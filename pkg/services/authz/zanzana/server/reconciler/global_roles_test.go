package reconciler

import (
	"context"
	"errors"
	"testing"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clienttesting "k8s.io/client-go/testing"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

type globalRoleTestServer struct {
	*stubServer
	tuples  []*openfgav1.Tuple
	writes  int
	added   []*openfgav1.TupleKey
	deleted []*openfgav1.TupleKeyWithoutCondition
}

func (s *globalRoleTestServer) ReadTuples(context.Context, *zanzana.StoreInfo, *openfgav1.ReadRequest) (*openfgav1.ReadResponse, error) {
	return &openfgav1.ReadResponse{Tuples: s.tuples}, nil
}

func (s *globalRoleTestServer) WriteTuples(_ context.Context, _ *zanzana.StoreInfo, added []*openfgav1.TupleKey, deleted []*openfgav1.TupleKeyWithoutCondition) error {
	s.added = append(s.added, added...)
	s.deleted = append(s.deleted, deleted...)
	s.writes++
	return nil
}

func newGlobalRoleTestClient(objects ...runtime.Object) *dynamicfake.FakeDynamicClient {
	return dynamicfake.NewSimpleDynamicClientWithCustomListKinds(runtime.NewScheme(), map[schema.GroupVersionResource]string{
		iamv0.GlobalRoleInfo.GroupVersionResource(): "GlobalRoleList",
		iamv0.RoleInfo.GroupVersionResource():       "RoleList",
		anonymousSettingsGVR:                        "SettingList",
	}, objects...)
}

func TestEnsureNamespace_GlobalRoleFetchFailureDoesNotMutateStore(t *testing.T) {
	for _, fetchErr := range []error{
		errors.New("global roles unavailable"),
		apierrors.NewNotFound(schema.GroupResource{Resource: "globalroles"}, ""),
	} {
		t.Run(fetchErr.Error(), func(t *testing.T) {
			dyn := newGlobalRoleTestClient()
			dyn.PrependReactor("list", "globalroles", func(clienttesting.Action) (bool, runtime.Object, error) {
				return true, nil, fetchErr
			})
			store := &zanzana.StoreInfo{ID: "store-1", Name: "test-ns"}
			srv := &globalRoleTestServer{stubServer: &stubServer{getStoreResults: []*zanzana.StoreInfo{store, store, store}}}
			state := newFakeStateStore()
			r := newReconcilerWithState(srv.stubServer, fakeAnonClientFactory{dyn: dyn}, state)
			r.server = srv
			r.cfg.CRDs = nil

			require.ErrorIs(t, r.EnsureNamespace(context.Background(), "test-ns"), fetchErr)
			require.Zero(t, srv.writes)
			require.Zero(t, srv.deleteStoreCalls.Load(), "a missing GlobalRole API is not a deleted namespace")
			require.False(t, state.has("test-ns"))
			_, cached := r.ensuredNamespaces.Load("test-ns")
			require.False(t, cached)
		})
	}
}

func TestEnsureNamespace_EmptyGlobalRoleSnapshot(t *testing.T) {
	store := &zanzana.StoreInfo{ID: "store-1", Name: "test-ns"}
	srv := &stubServer{getStoreResults: []*zanzana.StoreInfo{store, store, store}}
	r := newReconcilerWithState(srv, fakeAnonClientFactory{dyn: newGlobalRoleTestClient()}, newFakeStateStore())
	r.cfg.CRDs = nil
	require.NoError(t, r.EnsureNamespace(context.Background(), "test-ns"))
}

func TestQueueAllNamespaces_GlobalRoleFetchFailurePreservesSnapshot(t *testing.T) {
	for _, tc := range []struct {
		name  string
		perms map[string][]*authzextv1.RolePermission
	}{
		{name: "missing snapshot"},
		{name: "empty snapshot", perms: map[string][]*authzextv1.RolePermission{}},
		{name: "populated snapshot", perms: map[string][]*authzextv1.RolePermission{"reader": {{Action: "dashboards:read", Scope: "dashboards:uid:d1"}}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dyn := newGlobalRoleTestClient()
			dyn.PrependReactor("list", "globalroles", func(clienttesting.Action) (bool, runtime.Object, error) {
				return true, nil, errors.New("global roles unavailable")
			})
			srv := &globalRoleTestServer{stubServer: &stubServer{listAllStoresResults: []zanzana.StoreInfo{{Name: "test-ns"}}}}
			for name, perms := range tc.perms {
				tuples, err := zanzana.RoleToTuples(name, perms)
				require.NoError(t, err)
				require.NotEmpty(t, tuples)
				for _, tuple := range tuples {
					srv.tuples = append(srv.tuples, toTuple(tuple))
				}
			}
			// The namespace Role was deleted, but its permission tuple remains in Zanzana.
			revoked := makeTuple("role:deleted-role#assignee", "get", "resource:dashboard.grafana.app/dashboards/d1")
			srv.tuples = append(srv.tuples, toTuple(revoked))
			r := newReconcilerForTest(srv.stubServer, fakeAnonClientFactory{dyn: dyn})
			r.server = srv
			r.cfg.CRDs = []schema.GroupVersionResource{iamv0.RoleInfo.GroupVersionResource()}
			r.workQueue = make(chan string, 1)
			r.setGlobalRolePerms(tc.perms)

			r.queueAllNamespaces(context.Background())

			require.Equal(t, tc.perms, r.getGlobalRolePerms())
			if tc.perms == nil {
				require.Empty(t, r.workQueue)
				require.Zero(t, srv.writes)
				return
			}
			require.Len(t, r.workQueue, 1)
			r.runNamespaceReconciliation(context.Background(), <-r.workQueue, 0)
			require.Equal(t, 1, srv.writes)
			require.Empty(t, srv.added)
			require.Equal(t, []*openfgav1.TupleKeyWithoutCondition{{User: revoked.User, Relation: revoked.Relation, Object: revoked.Object}}, srv.deleted)
		})
	}
}

func TestEnsureNamespace_FollowerPreservesGlobalRolePermissions(t *testing.T) {
	for _, composed := range []bool{false, true} {
		name := "standalone"
		if composed {
			name = "composed"
		}
		t.Run(name, func(t *testing.T) {
			globalRole := &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": "iam.grafana.app/v0alpha1", "kind": "GlobalRole",
				"metadata": map[string]any{"name": "global-reader"},
				"spec":     map[string]any{"permissions": []any{map[string]any{"action": "dashboards:read", "scope": "dashboards:uid:d1"}}},
			}}
			objects := []runtime.Object{globalRole}
			roleName := "global-reader"
			if composed {
				roleName = "custom-reader"
				objects = append(objects, &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": "iam.grafana.app/v0alpha1", "kind": "Role",
					"metadata": map[string]any{"name": roleName, "namespace": "test-ns"},
					"spec":     map[string]any{"roleRefs": []any{map[string]any{"kind": "GlobalRole", "name": "global-reader"}}},
				}})
			}
			tuples, err := zanzana.RoleToTuples(roleName, []*authzextv1.RolePermission{{Action: "dashboards:read", Scope: "dashboards:uid:d1"}})
			require.NoError(t, err)
			require.NotEmpty(t, tuples)
			store := &zanzana.StoreInfo{ID: "store-1", Name: "test-ns"}
			srv := &globalRoleTestServer{stubServer: &stubServer{getStoreResults: []*zanzana.StoreInfo{store, store, store}}}
			for _, tuple := range tuples {
				srv.tuples = append(srv.tuples, toTuple(tuple))
			}
			state := newFakeStateStore()
			state.record(t, "test-ns", namespaceState{StoreID: "other-store", Version: stateVersion})
			r := newReconcilerWithState(srv.stubServer, fakeAnonClientFactory{dyn: newGlobalRoleTestClient(objects...)}, state)
			r.server = srv
			r.cfg.CRDs = []schema.GroupVersionResource{iamv0.RoleInfo.GroupVersionResource()}

			require.NoError(t, r.EnsureNamespace(context.Background(), "test-ns"))
			require.Zero(t, srv.writes, "a follower must preserve existing GlobalRole-derived tuples")
			require.Equal(t, "store-1", state.state(t, "test-ns").StoreID)
		})
	}
}
