package builders

import (
	"context"
	"errors"
	"sort"
	"sync"
	"testing"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	uiOwner    = "usageinsights.grafana.app"
	plGroup    = "playlist.grafana.app"
	plResource = "playlists"
	testNS     = "default"
)

var plGVR = schema.GroupVersionResource{Group: plGroup, Version: "v1", Resource: plResource}

func newKVFieldsStore(t *testing.T) *kv.ResourceKVStore {
	t.Helper()
	db, err := badger.Open(badger.DefaultOptions("").WithInMemory(true).WithLogger(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return kv.NewResourceKVStore(kv.NewBadgerKV(db))
}

func saveKV(t *testing.T, s *kv.ResourceKVStore, group, res, ns, name, owner, key, value string) {
	t.Helper()
	require.NoError(t, s.Save(context.Background(), kv.ResourceParent{Group: group, Resource: res, Namespace: ns, Name: name}, owner, key, []byte(value), "test"))
}

func kvFieldDef(name, owner, key, path string, typ resource.SearchFieldType) resource.SearchFieldDefinition {
	return resource.SearchFieldDefinition{
		Name:         name,
		Type:         typ,
		Capabilities: []resource.SearchCapability{resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve},
		KVSource:     &resource.KVFieldSource{Owner: owner, Key: key, Path: path},
	}
}

func playlistViewDefs() []resource.SearchFieldDefinition {
	return []resource.SearchFieldDefinition{
		{Name: "title_copy", Path: "spec.title", Type: resource.SearchFieldTypeString, Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter}},
		kvFieldDef("views_total", uiOwner, "stats", "views_total", resource.SearchFieldTypeInt64),
		kvFieldDef("views_today", uiOwner, "stats", "views_today", resource.SearchFieldTypeInt64),
	}
}

// recordingReader wraps a KVSourceReader and records each (owner, key) scanned.
type recordingReader struct {
	inner KVSourceReader
	mu    sync.Mutex
	calls [][2]string
	err   error
}

var _ KVSourceReader = (*kv.ResourceKVStore)(nil)

func (r *recordingReader) ScanNamespaceOwnerKey(ctx context.Context, group, res, ns, owner, key string) ([]kv.ResourceKVItem, error) {
	r.mu.Lock()
	r.calls = append(r.calls, [2]string{owner, key})
	r.mu.Unlock()
	if r.err != nil {
		return nil, r.err
	}
	return r.inner.ScanNamespaceOwnerKey(ctx, group, res, ns, owner, key)
}

// staticReader returns fixed items regardless of the request, so drift that
// the real store would reject on write can still be exercised.
type staticReader struct{ items []kv.ResourceKVItem }

func (s staticReader) ScanNamespaceOwnerKey(_ context.Context, _, _, _, owner, key string) ([]kv.ResourceKVItem, error) {
	var out []kv.ResourceKVItem
	for _, it := range s.items {
		if it.Owner == owner && it.Key == key {
			out = append(out, it)
		}
	}
	return out, nil
}

func TestBuildKVFieldSnapshot_ReadsDeclaredSources(t *testing.T) {
	t.Parallel()
	store := newKVFieldsStore(t)
	saveKV(t, store, plGroup, plResource, testNS, "p-high", uiOwner, "stats", `{"views_total":30,"views_today":2}`)
	saveKV(t, store, plGroup, plResource, testNS, "p-low", uiOwner, "stats", `{"views_total":3}`)
	// Noise the snapshot must not pick up.
	saveKV(t, store, plGroup, plResource, testNS, "p-other-owner", "other.grafana.app", "stats", `{"views_total":999}`)
	saveKV(t, store, plGroup, plResource, testNS, "p-other-key", uiOwner, "daily", `{"views_total":999}`)
	saveKV(t, store, plGroup, plResource, "other-ns", "p-other-ns", uiOwner, "stats", `{"views_total":999}`)
	saveKV(t, store, "dashboard.grafana.app", "dashboards", testNS, "d1", uiOwner, "stats", `{"views_total":999}`)

	rec := &recordingReader{inner: store}
	snap, err := BuildKVFieldSnapshot(context.Background(), rec, plGroup, plResource, testNS, playlistViewDefs())
	require.NoError(t, err)

	assert.Equal(t, resource.KVFieldSnapshot{
		"p-high": {"views_total": int64(30), "views_today": int64(2)},
		"p-low":  {"views_total": int64(3)},
	}, snap)

	rec.mu.Lock()
	defer rec.mu.Unlock()
	require.NotEmpty(t, rec.calls)
	for _, c := range rec.calls {
		assert.Equal(t, [2]string{uiOwner, "stats"}, c, "only the declared (owner, key) may be read")
	}
}

func TestBuildKVFieldSnapshot_MultipleSourcesAndNestedPath(t *testing.T) {
	t.Parallel()
	store := newKVFieldsStore(t)
	saveKV(t, store, plGroup, plResource, testNS, "p1", uiOwner, "stats", `{"views_total":5}`)
	saveKV(t, store, plGroup, plResource, testNS, "p1", "other.grafana.app", "rollup", `{"totals":{"ratio":0.5,"label":"hot","on":true}}`)

	defs := []resource.SearchFieldDefinition{
		kvFieldDef("views_total", uiOwner, "stats", "views_total", resource.SearchFieldTypeInt64),
		kvFieldDef("ratio", "other.grafana.app", "rollup", "totals.ratio", resource.SearchFieldTypeDouble),
		kvFieldDef("label", "other.grafana.app", "rollup", "totals.label", resource.SearchFieldTypeString),
		kvFieldDef("on", "other.grafana.app", "rollup", "totals.on", resource.SearchFieldTypeBoolean),
	}
	rec := &recordingReader{inner: store}
	snap, err := BuildKVFieldSnapshot(context.Background(), rec, plGroup, plResource, testNS, defs)
	require.NoError(t, err)
	assert.Equal(t, resource.KVFieldSnapshot{
		"p1": {"views_total": int64(5), "ratio": 0.5, "label": "hot", "on": true},
	}, snap)

	rec.mu.Lock()
	defer rec.mu.Unlock()
	pairs := map[[2]string]bool{}
	for _, c := range rec.calls {
		pairs[c] = true
	}
	assert.Equal(t, map[[2]string]bool{{uiOwner, "stats"}: true, {"other.grafana.app", "rollup"}: true}, pairs)
}

func TestBuildKVFieldSnapshot_DriftIsAbsentNotError(t *testing.T) {
	t.Parallel()
	item := func(name, value string) kv.ResourceKVItem {
		return kv.ResourceKVItem{Name: name, Owner: uiOwner, Key: "stats", Value: []byte(value)}
	}
	r := staticReader{items: []kv.ResourceKVItem{
		item("ok", `{"views_total":7}`),
		item("not-json", `{not json`),
		item("array", `[1,2,3]`),
		item("scalar", `42`),
		item("missing-path", `{"views_today":1}`),
		item("wrong-type", `{"views_total":"many"}`),
		item("null-value", `{"views_total":null}`),
		item("object-value", `{"views_total":{"a":1}}`),
		item("partial", `{"views_total":"bad","views_today":4}`),
	}}
	snap, err := BuildKVFieldSnapshot(context.Background(), r, plGroup, plResource, testNS, playlistViewDefs())
	require.NoError(t, err)

	assert.Equal(t, map[string]any{"views_total": int64(7)}, snap["ok"])
	assert.Equal(t, map[string]any{"views_today": int64(4)}, snap["partial"])
	for _, name := range []string{"not-json", "array", "scalar", "wrong-type", "null-value", "object-value"} {
		assert.Empty(t, snap[name], "%s must contribute no fields", name)
	}
	assert.Equal(t, map[string]any{"views_today": int64(1)}, snap["missing-path"])
}

func TestBuildKVFieldSnapshot_ReaderErrorIsReturned(t *testing.T) {
	t.Parallel()
	boom := errors.New("boom")
	rec := &recordingReader{inner: newKVFieldsStore(t), err: boom}
	_, err := BuildKVFieldSnapshot(context.Background(), rec, plGroup, plResource, testNS, playlistViewDefs())
	require.ErrorIs(t, err, boom)
}

func TestBuildKVFieldSnapshot_NoKVDefsIsEmpty(t *testing.T) {
	t.Parallel()
	rec := &recordingReader{inner: newKVFieldsStore(t)}
	defs := []resource.SearchFieldDefinition{{Name: "t", Path: "spec.title", Type: resource.SearchFieldTypeString}}
	snap, err := BuildKVFieldSnapshot(context.Background(), rec, plGroup, plResource, testNS, defs)
	require.NoError(t, err)
	assert.Empty(t, snap)
	assert.Empty(t, rec.calls, "no KV-sourced defs means no reads")
}

// fakeInner returns a fixed document for any key.
type fakeInner struct{ err error }

func (f fakeInner) BuildDocument(_ context.Context, key *resourcepb.ResourceKey, rv int64, _ []byte) (*resource.IndexableDocument, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &resource.IndexableDocument{
		Key:    key,
		RV:     rv,
		Name:   key.Name,
		Title:  "title-" + key.Name,
		Fields: map[string]any{"inner_field": "kept"},
	}, nil
}

func playlistProvider() resource.SearchFieldsProvider {
	return resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
		plGVR: playlistViewDefs(),
	}, nil)
}

func playlistKey(name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: testNS, Group: plGroup, Resource: plResource, Name: name}
}

func playlistBody(name string) []byte {
	return []byte(`{"apiVersion":"playlist.grafana.app/v1","kind":"Playlist","metadata":{"name":"` + name + `","namespace":"default"},"spec":{"title":"T"}}`)
}

func TestNewKVSourcedDocumentBuilder_FillsByName(t *testing.T) {
	t.Parallel()
	snap := resource.KVFieldSnapshot{
		"p-high": {"views_total": int64(30), "views_today": int64(2), "undeclared": int64(1)},
	}
	b := NewKVSourcedDocumentBuilder(fakeInner{}, playlistProvider(), snap)

	t.Run("resource with a snapshot gets its declared fields", func(t *testing.T) {
		t.Parallel()
		doc, err := b.BuildDocument(context.Background(), playlistKey("p-high"), 7, playlistBody("p-high"))
		require.NoError(t, err)
		assert.Equal(t, int64(30), doc.Fields["views_total"])
		assert.Equal(t, int64(2), doc.Fields["views_today"])
		_, has := doc.Fields["undeclared"]
		assert.False(t, has, "only fields the kind declares are copied")
		assert.Equal(t, "kept", doc.Fields["inner_field"], "inner fields are preserved")
		assert.Equal(t, "title-p-high", doc.Title)
		assert.Equal(t, int64(7), doc.RV)
	})

	t.Run("resource without a snapshot has the fields absent", func(t *testing.T) {
		t.Parallel()
		doc, err := b.BuildDocument(context.Background(), playlistKey("p-none"), 1, playlistBody("p-none"))
		require.NoError(t, err)
		_, has := doc.Fields["views_total"]
		assert.False(t, has)
		assert.Equal(t, "kept", doc.Fields["inner_field"])
	})

	t.Run("reports the snapshot it was built with", func(t *testing.T) {
		t.Parallel()
		s, ok := b.(resource.KVFieldSnapshotter)
		require.True(t, ok, "builder must implement resource.KVFieldSnapshotter")
		got, ok := s.KVFieldSnapshot()
		assert.True(t, ok)
		assert.Equal(t, snap, got)
	})

	t.Run("inner error propagates", func(t *testing.T) {
		t.Parallel()
		boom := errors.New("inner failed")
		_, err := NewKVSourcedDocumentBuilder(fakeInner{err: boom}, playlistProvider(), snap).
			BuildDocument(context.Background(), playlistKey("p-high"), 1, playlistBody("p-high"))
		require.ErrorIs(t, err, boom)
	})
}

func TestNewKVSourcedDocumentBuilder_WithStandardInner(t *testing.T) {
	t.Parallel()
	provider := playlistProvider()
	registry := resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
		resource.NewLowerGroupResource(plGroup, plResource): provider,
	})
	snap := resource.KVFieldSnapshot{"p1": {"views_total": int64(12)}}
	b := NewKVSourcedDocumentBuilder(resource.StandardDocumentBuilder(registry), provider, snap)

	doc, err := b.BuildDocument(context.Background(), playlistKey("p1"), 1, playlistBody("p1"))
	require.NoError(t, err)
	assert.Equal(t, int64(12), doc.Fields["views_total"])
	assert.Equal(t, "T", doc.Fields["title_copy"], "path-sourced fields from the standard builder are kept")
}

func kvSourcedRegistry(t *testing.T) *resource.SearchFieldsRegistry {
	t.Helper()
	mk := func(group, res string, defs ...resource.SearchFieldDefinition) (resource.LowerGroupResource, resource.SearchFieldsProvider) {
		return resource.NewLowerGroupResource(group, res), resource.NewMapProvider(map[schema.GroupVersionResource][]resource.SearchFieldDefinition{
			{Group: group, Version: "v1", Resource: res}: defs,
		}, nil)
	}
	views := kvFieldDef("views_total", uiOwner, "stats", "views_total", resource.SearchFieldTypeInt64)
	pathOnly := resource.SearchFieldDefinition{Name: "t", Path: "spec.title", Type: resource.SearchFieldTypeString}
	providers := map[resource.LowerGroupResource]resource.SearchFieldsProvider{}
	for _, e := range []struct {
		g, r string
		d    []resource.SearchFieldDefinition
	}{
		{plGroup, plResource, []resource.SearchFieldDefinition{views}},
		{"widgets.example.grafana.app", "widgets", []resource.SearchFieldDefinition{views}},
		{"dashboard.grafana.app", "dashboards", []resource.SearchFieldDefinition{views}},
		{"folder.grafana.app", "folders", []resource.SearchFieldDefinition{pathOnly}},
	} {
		k, p := mk(e.g, e.r, e.d...)
		providers[k] = p
	}
	return resource.NewSearchFieldsRegistry(nil, nil, providers)
}

func TestKVSourcedDocumentBuilders_OnePerKVSourcedKind(t *testing.T) {
	t.Parallel()
	store := newKVFieldsStore(t)
	infos := KVSourcedDocumentBuilders(kvSourcedRegistry(t), store, map[schema.GroupResource]bool{
		{Group: "dashboard.grafana.app", Resource: "dashboards"}: true,
	})

	var got []string
	for _, info := range infos {
		got = append(got, info.GroupResource.String())
		assert.NotNil(t, info.Namespaced, "%s must have a namespaced supplier", info.GroupResource)
	}
	sort.Strings(got)
	assert.Equal(t, []string{"playlists.playlist.grafana.app", "widgets.widgets.example.grafana.app"}, got)
}

func TestKVSourcedDocumentBuilders_NamespacedBuilderReadsThatNamespace(t *testing.T) {
	t.Parallel()
	store := newKVFieldsStore(t)
	saveKV(t, store, plGroup, plResource, testNS, "p1", uiOwner, "stats", `{"views_total":30}`)
	saveKV(t, store, plGroup, plResource, "other-ns", "p1", uiOwner, "stats", `{"views_total":999}`)

	infos := KVSourcedDocumentBuilders(kvSourcedRegistry(t), store, nil)
	var info *resource.DocumentBuilderInfo
	for i := range infos {
		if infos[i].GroupResource == (schema.GroupResource{Group: plGroup, Resource: plResource}) {
			info = &infos[i]
		}
	}
	require.NotNil(t, info, "playlists must get a builder")
	require.NotNil(t, info.Namespaced)

	b, err := info.Namespaced(context.Background(), testNS, nil)
	require.NoError(t, err)
	doc, err := b.BuildDocument(context.Background(), playlistKey("p1"), 1, playlistBody("p1"))
	require.NoError(t, err)
	assert.Equal(t, int64(30), doc.Fields["views_total"])

	s, ok := b.(resource.KVFieldSnapshotter)
	require.True(t, ok)
	snap, ok := s.KVFieldSnapshot()
	require.True(t, ok)
	assert.Equal(t, resource.KVFieldSnapshot{"p1": {"views_total": int64(30)}}, snap)
}

func TestKVSourcedDocumentBuilders_NilReaderReturnsNone(t *testing.T) {
	t.Parallel()
	assert.Empty(t, KVSourcedDocumentBuilders(kvSourcedRegistry(t), nil, nil))
}

func TestKVSourcedDocumentBuilders_AllSkippedReturnsNone(t *testing.T) {
	t.Parallel()
	infos := KVSourcedDocumentBuilders(kvSourcedRegistry(t), newKVFieldsStore(t), map[schema.GroupResource]bool{
		{Group: plGroup, Resource: plResource}:                      true,
		{Group: "widgets.example.grafana.app", Resource: "widgets"}: true,
		{Group: "dashboard.grafana.app", Resource: "dashboards"}:    true,
	})
	assert.Empty(t, infos)
}
