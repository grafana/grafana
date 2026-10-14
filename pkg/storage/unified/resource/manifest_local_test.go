package resource

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-app-sdk/app"
)

// fakeGroupSource stands in for the router in this process.
type fakeGroupSource struct {
	mu        sync.Mutex
	manifests map[string]*app.ManifestData
	versions  map[string]string
	notReady  bool
	lookups   int
}

func (f *fakeGroupSource) GroupManifest(group string) (*app.ManifestData, string, bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.lookups++
	if f.notReady {
		return nil, "", false, ErrManifestSourceNotReady
	}
	m, ok := f.manifests[group]
	return m, f.versions[group], ok, nil
}

func (f *fakeGroupSource) serve(t *testing.T, version string, searchFields ...string) {
	t.Helper()
	m, err := ManifestFromUnstructured(widgetsManifest(searchFields...))
	require.NoError(t, err)
	f.mu.Lock()
	defer f.mu.Unlock()
	f.manifests = map[string]*app.ManifestData{"widgets.test": m}
	f.versions = map[string]string{"widgets.test": version}
}

func (f *fakeGroupSource) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.lookups
}

// localResolver wires a local resolver into a fresh registry, on a fake clock
// with background revalidation run synchronously.
func localResolver(t *testing.T, local *LocalManifestSource) (*ManifestResolver, SearchOptions, *fakeClock) {
	t.Helper()
	opts := SearchOptions{SearchFields: NewSearchFieldsRegistry(nil, nil, nil), EmbeddingConfig: NewEmbeddingConfigRegistry()}
	r := NewLocalManifestResolver(local, nil, nil, func(live []*app.ManifestData) error {
		return opts.ReloadManifests(nil, live)
	})
	clock := &fakeClock{now: time.Unix(1_700_000_000, 0)}
	r.now = clock.Now
	r.background = func(f func()) { f() }
	opts.SearchFields.SetResolver(r)
	return r, opts, clock
}

func widgetsFields(t *testing.T, opts SearchOptions) []string {
	t.Helper()
	_, _, provider := opts.SearchFields.For(widgetsKey)
	if provider == nil {
		return nil
	}
	var names []string
	for _, f := range provider.Fields(schema.GroupVersionResource{Group: "widgets.test", Version: "v1", Resource: "widgets"}) {
		names = append(names, f.Name)
	}
	return names
}

func TestLocalManifestResolver_LoadsGroupFromLocalRouter(t *testing.T) {
	src := &fakeGroupSource{}
	src.serve(t, "key-1", "title")
	local := ProvideLocalManifestSource()
	local.Set(src)
	_, opts, _ := localResolver(t, local)

	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Equal(t, []string{"title"}, widgetsFields(t, opts))
}

func TestLocalManifestResolver_NewVersionIsPublished(t *testing.T) {
	src := &fakeGroupSource{}
	src.serve(t, "key-1", "title")
	local := ProvideLocalManifestSource()
	local.Set(src)
	r, opts, clock := localResolver(t, local)
	opts.SearchFields.Resolve(t.Context(), widgetsKey)

	// Same backend key: answered as not modified.
	clock.Advance(r.maxAge)
	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Equal(t, 2, src.count())
	require.Equal(t, []string{"title"}, widgetsFields(t, opts))

	// The plugin was upgraded: a new key and new fields.
	src.serve(t, "key-2", "title", "body")
	clock.Advance(r.maxAge)
	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Equal(t, []string{"title", "body"}, widgetsFields(t, opts))
}

func TestLocalManifestResolver_WaitsForRouterToRegister(t *testing.T) {
	local := ProvideLocalManifestSource()
	r, opts, clock := localResolver(t, local)

	// Storage is built before the router; until it registers, nothing is
	// remembered as missing.
	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Nil(t, widgetsFields(t, opts))

	src := &fakeGroupSource{}
	src.serve(t, "key-1", "title")
	local.Set(src)
	clock.Advance(r.retryInterval)
	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Equal(t, []string{"title"}, widgetsFields(t, opts))
}

func TestLocalManifestResolver_RetriesUntilRouterReconciles(t *testing.T) {
	src := &fakeGroupSource{notReady: true}
	local := ProvideLocalManifestSource()
	local.Set(src)
	r, opts, clock := localResolver(t, local)

	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Nil(t, widgetsFields(t, opts))

	src.mu.Lock()
	src.notReady = false
	src.mu.Unlock()
	src.serve(t, "key-1", "title")
	clock.Advance(r.retryInterval)
	opts.SearchFields.Resolve(t.Context(), widgetsKey)
	require.Equal(t, []string{"title"}, widgetsFields(t, opts))
}

func TestLocalManifestSource_SetIsNilSafe(t *testing.T) {
	var local *LocalManifestSource
	local.Set(&fakeGroupSource{})
}
