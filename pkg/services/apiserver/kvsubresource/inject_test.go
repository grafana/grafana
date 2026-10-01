package kvsubresource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"

	app "github.com/grafana/grafana-app-sdk/app"
)

// ─── test-only storage fakes ─────────────────────────────────────────────────

// storageWithGetter implements rest.Storage + rest.Getter.
// Used to verify that InjectForManifest picks up the Getter.
type storageWithGetter struct {
	getter getterFunc
}

func (s *storageWithGetter) New() runtime.Object { return &fakeParent{} }
func (s *storageWithGetter) Destroy()            {}
func (s *storageWithGetter) Get(ctx context.Context, name string, opts *metav1.GetOptions) (runtime.Object, error) {
	return s.getter(ctx, name, opts)
}

// storageWithoutGetter implements rest.Storage but NOT rest.Getter.
// Used to verify that InjectForManifest skips the kind gracefully.
type storageWithoutGetter struct{}

func (s *storageWithoutGetter) New() runtime.Object { return &fakeParent{} }
func (s *storageWithoutGetter) Destroy()            {}

var _ rest.Storage = (*storageWithGetter)(nil)
var _ rest.Getter = (*storageWithGetter)(nil)
var _ rest.Storage = (*storageWithoutGetter)(nil)

// ─── helpers ─────────────────────────────────────────────────────────────────

// newManifest builds a ManifestData with a single version containing the
// supplied kinds. The group is "test.grafana.app".
func newManifest(group, version string, kinds ...app.ManifestVersionKind) *app.ManifestData {
	return &app.ManifestData{
		AppName: "test",
		Group:   group,
		Versions: []app.ManifestVersion{
			{Name: version, Served: true, Kinds: kinds},
		},
	}
}

// newManifestKind builds a ManifestVersionKind with a given plural, scope, and
// optional KV declaration.
func newManifestKind(kind, plural, scope string, kv *app.ManifestVersionKindKV) app.ManifestVersionKind {
	return app.ManifestVersionKind{
		Kind:  kind,
		Scope: scope,
		// Set Plural so Resource() is predictable (e.g. "widgets" rather than kind+"s").
		Plural: plural,
		KV:     kv,
	}
}

// newAPIGroupInfo builds an APIGroupInfo with a fresh scheme and a
// pre-populated storage map.
func newAPIGroupInfo(storageMap map[string]map[string]rest.Storage) *genericapiserver.APIGroupInfo {
	return &genericapiserver.APIGroupInfo{
		Scheme:                       runtime.NewScheme(),
		VersionedResourcesStorageMap: storageMap,
	}
}

// ─── nil-dependency guards ────────────────────────────────────────────────────

// TestInjectForManifest_NilManifest_IsNoOp verifies that a nil manifest leaves
// the storage map completely untouched.
func TestInjectForManifest_NilManifest_IsNoOp(t *testing.T) {
	t.Parallel()
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithGetter{}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, nil, newKVClient(t), denyAll())

	// Only the original entry must remain.
	require.Len(t, storage["v1"], 1)
	_, hasKV := storage["v1"]["widgets/kv"]
	assert.False(t, hasKV, "nil manifest must leave storage untouched")
}

// TestInjectForManifest_NilKVClient_IsNoOp verifies that a nil kvClient leaves
// the storage map untouched.
func TestInjectForManifest_NilKVClient_IsNoOp(t *testing.T) {
	t.Parallel()
	kv := &app.ManifestVersionKindKV{}
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Namespaced", kv),
	)
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithGetter{}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, nil, denyAll())

	require.Len(t, storage["v1"], 1, "nil kvClient must leave storage untouched")
}

// TestInjectForManifest_NilAccess_IsNoOp verifies that a nil access control
// leaves the storage map untouched.
func TestInjectForManifest_NilAccess_IsNoOp(t *testing.T) {
	t.Parallel()
	kv := &app.ManifestVersionKindKV{}
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Namespaced", kv),
	)
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithGetter{}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, newKVClient(t), nil)

	require.Len(t, storage["v1"], 1, "nil access must leave storage untouched")
}

// ─── namespaced kind WITH KV ──────────────────────────────────────────────────

// TestInjectForManifest_NamespacedKindWithKV_InjectsStorageEntries verifies
// that a namespaced kind with HasKV() == true receives both "{plural}/kv" and
// "{plural}/kv:batch" storage entries, and that KVResponse is registered in
// the scheme for the group-version.
func TestInjectForManifest_NamespacedKindWithKV_InjectsStorageEntries(t *testing.T) {
	t.Parallel()
	const (
		group    = "test.grafana.app"
		version  = "v1"
		resource = "widgets"
	)
	manifest := newManifest(group, version,
		newManifestKind("Widget", "Widgets", "Namespaced", &app.ManifestVersionKindKV{}),
	)
	storage := map[string]map[string]rest.Storage{
		version: {resource: &storageWithGetter{getter: successGetter(testNS, "w1")}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, newKVClient(t), denyAll())

	// Both subresource keys must now be present.
	kvEntry, hasKV := storage[version][resource+"/kv"]
	require.True(t, hasKV, "widgets/kv must be injected")
	require.NotNil(t, kvEntry)

	batchEntry, hasBatch := storage[version][resource+"/kv:batch"]
	require.True(t, hasBatch, "widgets/kv:batch must be injected")
	require.NotNil(t, batchEntry)

	// Both entries must point to the same connector instance.
	assert.Same(t, kvEntry, batchEntry, "kv and kv:batch must share the same connector")

	// KVResponse must be registered in the scheme for this group-version.
	gv := schema.GroupVersion{Group: group, Version: version}
	obj, err := g.Scheme.New(gv.WithKind("KVResponse"))
	require.NoError(t, err, "KVResponse must be registered in the scheme")
	_, ok := obj.(*KVResponse)
	require.True(t, ok)
}

// ─── namespaced kind WITHOUT KV ───────────────────────────────────────────────

// TestInjectForManifest_NamespacedKindWithoutKV_IsSkipped verifies that a kind
// without a KV declaration does not receive kv subresource entries.
func TestInjectForManifest_NamespacedKindWithoutKV_IsSkipped(t *testing.T) {
	t.Parallel()
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Namespaced", nil /* no KV */),
	)
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithGetter{}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, newKVClient(t), denyAll())

	_, hasKV := storage["v1"]["widgets/kv"]
	assert.False(t, hasKV, "kind without KV declaration must not get widgets/kv")
	_, hasBatch := storage["v1"]["widgets/kv:batch"]
	assert.False(t, hasBatch, "kind without KV declaration must not get widgets/kv:batch")
	// Original entry intact.
	assert.Len(t, storage["v1"], 1)
}

// ─── cluster-scoped kind WITH KV ─────────────────────────────────────────────

// TestInjectForManifest_ClusterScopedKindWithKV_IsSkipped verifies that a
// cluster-scoped kind (even one with HasKV() == true) is skipped, as the KV
// subresource is only defined for namespaced resources.
func TestInjectForManifest_ClusterScopedKindWithKV_IsSkipped(t *testing.T) {
	t.Parallel()
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Cluster", &app.ManifestVersionKindKV{}),
	)
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithGetter{}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, newKVClient(t), denyAll())

	_, hasKV := storage["v1"]["widgets/kv"]
	assert.False(t, hasKV, "cluster-scoped kind must not get kv injection")
	assert.Len(t, storage["v1"], 1)
}

// ─── versions are independent ─────────────────────────────────────────────────

// TestInjectForManifest_VersionsHandledIndependently verifies that when a
// manifest has multiple versions, only the version that declares KV receives
// the injected subresource entries.
func TestInjectForManifest_VersionsHandledIndependently(t *testing.T) {
	t.Parallel()
	const group = "test.grafana.app"
	manifest := &app.ManifestData{
		AppName: "test",
		Group:   group,
		Versions: []app.ManifestVersion{
			{
				Name:   "v1",
				Served: true,
				Kinds: []app.ManifestVersionKind{
					newManifestKind("Widget", "widgets", "Namespaced", &app.ManifestVersionKindKV{}),
				},
			},
			{
				Name:   "v2",
				Served: true,
				Kinds: []app.ManifestVersionKind{
					// v2 does NOT declare KV.
					newManifestKind("Widget", "widgets", "Namespaced", nil),
				},
			},
		},
	}
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithGetter{getter: successGetter(testNS, "w1")}},
		"v2": {"widgets": &storageWithGetter{getter: successGetter(testNS, "w1")}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, newKVClient(t), denyAll())

	// v1 (declaring) must have kv injected.
	_, v1KV := storage["v1"]["widgets/kv"]
	require.True(t, v1KV, "v1 must have widgets/kv injected")

	// v2 (non-declaring) must NOT.
	_, v2KV := storage["v2"]["widgets/kv"]
	assert.False(t, v2KV, "v2 must NOT have widgets/kv injected")

	// Scheme must have KVResponse registered for v1 but not necessarily crash for v2.
	gv1 := schema.GroupVersion{Group: group, Version: "v1"}
	obj, err := g.Scheme.New(gv1.WithKind("KVResponse"))
	require.NoError(t, err)
	_, ok := obj.(*KVResponse)
	require.True(t, ok)
}

// ─── missing parent storage ───────────────────────────────────────────────────

// TestInjectForManifest_MissingParentStorage_DoesNotPanic verifies that when
// the manifest declares KV but the storage map has no entry for the parent
// resource, InjectForManifest skips silently without panicking.
func TestInjectForManifest_MissingParentStorage_DoesNotPanic(t *testing.T) {
	t.Parallel()
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Namespaced", &app.ManifestVersionKindKV{}),
	)
	// Storage map has no "widgets" entry.
	storage := map[string]map[string]rest.Storage{
		"v1": {},
	}
	g := newAPIGroupInfo(storage)

	require.NotPanics(t, func() {
		InjectForManifest(g, manifest, newKVClient(t), denyAll())
	})

	// Nothing must have been inserted.
	assert.Empty(t, storage["v1"])
}

// ─── parent storage is not a Getter ───────────────────────────────────────────

// TestInjectForManifest_ParentStorageNotGetter_DoesNotPanic verifies that when
// the parent storage exists but does not implement rest.Getter, InjectForManifest
// skips the kind without panicking.
func TestInjectForManifest_ParentStorageNotGetter_DoesNotPanic(t *testing.T) {
	t.Parallel()
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Namespaced", &app.ManifestVersionKindKV{}),
	)
	// Parent storage does NOT implement rest.Getter.
	storage := map[string]map[string]rest.Storage{
		"v1": {"widgets": &storageWithoutGetter{}},
	}
	g := newAPIGroupInfo(storage)

	require.NotPanics(t, func() {
		InjectForManifest(g, manifest, newKVClient(t), denyAll())
	})

	// Only the original entry must remain.
	assert.Len(t, storage["v1"], 1)
	_, hasKV := storage["v1"]["widgets/kv"]
	assert.False(t, hasKV)
}

// ─── existing parent storage used as Getter ──────────────────────────────────

// TestInjectForManifest_ExistingParentEntryUsedAsGetter verifies that the
// connector that InjectForManifest creates uses the pre-existing parent storage
// as its Getter. We confirm this indirectly by checking that Connect() does not
// error when called with the same name the getter returns.
func TestInjectForManifest_ExistingParentEntryUsedAsGetter(t *testing.T) {
	t.Parallel()
	const (
		group    = "test.grafana.app"
		version  = "v1"
		resource = "widgets"
	)
	manifest := newManifest(group, version,
		newManifestKind("Widget", "Widgets", "Namespaced", &app.ManifestVersionKindKV{}),
	)
	// The parent getter returns a valid object for name "w1".
	storage := map[string]map[string]rest.Storage{
		version: {resource: &storageWithGetter{getter: successGetter(testNS, "w1")}},
	}
	g := newAPIGroupInfo(storage)

	InjectForManifest(g, manifest, newKVClient(t), denyAll())

	conn, ok := storage[version][resource+"/kv"]
	require.True(t, ok, "widgets/kv must be present after injection")

	kvConn, ok := conn.(*KVConnector)
	require.True(t, ok, "injected entry must be a *KVConnector")

	// Call Connect with a valid identity context; it must not return an error.
	ctx := serviceCtx(t)
	handler, err := kvConn.Connect(ctx, "w1", nil, nil)
	require.NoError(t, err, "Connect must succeed when parent getter returns an object")
	require.NotNil(t, handler)
}

// ─── per-version StorageMap lookup ───────────────────────────────────────────

// TestInjectForManifest_VersionNotInStorageMap_IsSkipped verifies that a version
// present in the manifest but absent from the APIGroupInfo storage map is skipped.
func TestInjectForManifest_VersionNotInStorageMap_IsSkipped(t *testing.T) {
	t.Parallel()
	manifest := newManifest("test.grafana.app", "v1",
		newManifestKind("Widget", "widgets", "Namespaced", &app.ManifestVersionKindKV{}),
	)
	// Storage map has no "v1" version at all.
	storage := map[string]map[string]rest.Storage{}
	g := newAPIGroupInfo(storage)

	require.NotPanics(t, func() {
		InjectForManifest(g, manifest, newKVClient(t), denyAll())
	})

	assert.Empty(t, storage)
}
