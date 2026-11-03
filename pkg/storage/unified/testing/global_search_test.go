package test

import (
	"context"
	"encoding/json"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

const globalSearchNamespace = "stacks-77"

var (
	globalDashboards = schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	globalFolders    = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	globalPlaylists  = schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
)

// TestGlobalSearch runs the global search on real KV storage and a real Bleve
// index: the search server builds the index from storage, follows writes, and
// catches up with storage after missing one. Most global search tests use fakes,
// which check what the search server asks for rather than what the index does.
func TestGlobalSearch(t *testing.T) {
	storage := &droppingWatchBackend{StorageBackend: setupBadgerKV(t)}
	access := &globalSearchAccess{}
	coverage := resource.NewGlobalSearchCoverageRegistry(globalSearchManifests(true))
	root := t.TempDir()
	env := startGlobalSearchServer(t, storage, root, coverage, access)
	// The latest server, as the restart below replaces it.
	t.Cleanup(func() { env.stop(t) })

	env.write(t, globalFolders, "top", "", "Top")
	env.write(t, globalFolders, "team", "top", "Team")
	env.write(t, globalFolders, "hidden", "", "Hidden")
	env.write(t, globalFolders, "shared", "hidden", "Shared")
	env.write(t, globalDashboards, "cpu", "team", "CPU usage")
	env.write(t, globalDashboards, "memory", "top", "Memory usage")
	env.write(t, globalDashboards, "reports", "shared", "Reports")
	env.write(t, globalPlaylists, "tv", "", "TV")
	access.deny("hidden")

	t.Run("builds the index from storage and searches it", func(t *testing.T) {
		rsp := env.search(t)
		require.ElementsMatch(t, []string{
			"folders/top", "folders/team", "folders/shared",
			"dashboards/cpu", "dashboards/memory", "dashboards/reports",
		}, names(rsp), "the unreadable folder is filtered out, and so is the type the server does not check")
		require.Equal(t, []string{globalPlaylists.Group + "/" + globalPlaylists.Resource}, rsp.SkippedTypes)
		require.Equal(t, "Dashboard", rsp.Kinds["dashboard.grafana.app/dashboards"])

		require.ElementsMatch(t, []string{"dashboards/cpu", "dashboards/memory", "dashboards/reports"},
			names(env.search(t, filter(resource.SEARCH_FIELD_GROUP_RESOURCE, "dashboard.grafana.app/dashboards"))))
		require.ElementsMatch(t, []string{"folders/team", "dashboards/cpu", "dashboards/memory"},
			names(env.search(t, filter(resource.SEARCH_FIELD_FOLDER_TREE, "top"))))

		require.Equal(t, map[string][]string{
			"top":    {"top:Top"},
			"team":   {"top:Top", "team:Team"},
			"hidden": {"hidden!"},
			"shared": {"hidden!", "shared:Shared"},
		}, paths(rsp))
	})

	t.Run("follows writes", func(t *testing.T) {
		env.write(t, globalDashboards, "disk", "team", "Disk usage")
		env.waitFor(t, "a created dashboard", func(rsp *resourcepb.ResourceSearchResponse) bool {
			return titles(rsp)["dashboards/disk"] == "Disk usage"
		})
		env.write(t, globalDashboards, "disk", "team", "Disk space")
		env.waitFor(t, "a renamed dashboard", func(rsp *resourcepb.ResourceSearchResponse) bool {
			return titles(rsp)["dashboards/disk"] == "Disk space"
		})
		env.write(t, globalFolders, "team", "", "Team")
		env.waitFor(t, "a moved folder", func(rsp *resourcepb.ResourceSearchResponse) bool {
			return slices.Equal(paths(rsp)["team"], []string{"team:Team"})
		})
		env.delete(t, globalDashboards, "disk")
		env.waitFor(t, "a deleted dashboard", func(rsp *resourcepb.ResourceSearchResponse) bool {
			_, found := titles(rsp)["dashboards/disk"]
			return !found
		})
	})

	t.Run("catches up with storage after a missed write", func(t *testing.T) {
		storage.drop("missed")
		env.write(t, globalDashboards, "missed", "top", "Missed")
		// A write the watch did delivered after the missed one shows the missed
		// one had its chance.
		env.write(t, globalDashboards, "after", "top", "After")
		env.waitFor(t, "a write after the missed one", func(rsp *resourcepb.ResourceSearchResponse) bool {
			_, found := titles(rsp)["dashboards/after"]
			return found
		})
		_, found := titles(env.search(t))["dashboards/missed"]
		require.False(t, found, "the watch dropped this write")

		// A restarted server reopens the index it had open, and compares it with
		// storage before relying on it.
		env.stop(t)
		env = startGlobalSearchServer(t, storage, root, coverage, access)
		// Searches get 503 until the reopened index is ready.
		env.waitFor(t, "the missed write after a restart", func(rsp *resourcepb.ResourceSearchResponse) bool {
			return titles(rsp)["dashboards/missed"] == "Missed"
		})
	})

	t.Run("drops a type left out of the coverage", func(t *testing.T) {
		_, dropped := coverage.Reload(globalSearchManifests(false))
		require.Equal(t, []schema.GroupResource{globalFolders}, dropped)
		for _, name := range names(env.search(t)) {
			require.NotContains(t, name, "folders/", "a dropped type is hidden at once")
		}
		require.Eventually(t, func() bool {
			idx := env.index.PeekIndex(resource.GlobalSearchKey(globalSearchNamespace))
			if idx == nil {
				return false
			}
			types, err := idx.DocumentTypes()
			return err == nil && !slices.Contains(types, globalFolders)
		}, 10*time.Second, 20*time.Millisecond, "and then removed from the index")
	})
}

type globalSearchEnv struct {
	server resource.ResourceServer
	index  resource.SearchBackend
	ctx    context.Context
	once   sync.Once
}

func startGlobalSearchServer(t *testing.T, storage resource.StorageBackend, root string, coverage *resource.GlobalSearchCoverageRegistry, access *globalSearchAccess) *globalSearchEnv {
	t.Helper()
	index, err := search.NewBleveBackend(search.BleveOptions{Root: root}, nil)
	require.NoError(t, err)
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{
		Backend:      storage,
		AccessClient: access,
		Search: resource.SearchOptions{
			Backend: index,
			Resources: &resource.TestDocumentBuilderSupplier{GroupsResources: map[string]string{
				globalDashboards.Group: globalDashboards.Resource,
				globalFolders.Group:    globalFolders.Resource,
				globalPlaylists.Group:  globalPlaylists.Resource,
			}},
			GlobalIndexEnabled:   true,
			GlobalSearchCoverage: coverage,
			// Searches wait for a build rather than getting 503.
			GlobalIndexBuildWait: time.Minute,
		},
	})
	require.NoError(t, err)
	env := &globalSearchEnv{
		server: server,
		index:  index,
		// Not the test's context: a server started in one subtest is used by the next.
		ctx: identity.WithRequester(context.Background(), &identity.StaticRequester{
			Type: claims.TypeUser, UserID: 1, UserUID: "user-1", Namespace: globalSearchNamespace,
		}),
	}
	return env
}

func (e *globalSearchEnv) stop(t *testing.T) {
	e.once.Do(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		require.NoError(t, e.server.Stop(ctx))
	})
}

func (e *globalSearchEnv) write(t *testing.T, gr schema.GroupResource, name, folder, title string) {
	t.Helper()
	key := &resourcepb.ResourceKey{Namespace: globalSearchNamespace, Group: gr.Group, Resource: gr.Resource, Name: name}
	metadata := map[string]any{"name": name, "namespace": globalSearchNamespace}
	if folder != "" {
		metadata["annotations"] = map[string]any{"grafana.app/folder": folder}
	}
	value, err := json.Marshal(map[string]any{
		"apiVersion": gr.Group + "/v1",
		"kind":       kindOf(gr),
		"metadata":   metadata,
		"spec":       map[string]any{"title": title},
	})
	require.NoError(t, err)

	current, err := e.server.Read(e.ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	if current.Error != nil && current.Error.Code == 404 {
		rsp, err := e.server.Create(e.ctx, &resourcepb.CreateRequest{Key: key, Value: value})
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		return
	}
	require.Nil(t, current.Error)
	rsp, err := e.server.Update(e.ctx, &resourcepb.UpdateRequest{Key: key, Value: value, ResourceVersion: current.ResourceVersion})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
}

func (e *globalSearchEnv) delete(t *testing.T, gr schema.GroupResource, name string) {
	t.Helper()
	key := &resourcepb.ResourceKey{Namespace: globalSearchNamespace, Group: gr.Group, Resource: gr.Resource, Name: name}
	current, err := e.server.Read(e.ctx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, err)
	require.Nil(t, current.Error)
	rsp, err := e.server.Delete(e.ctx, &resourcepb.DeleteRequest{Key: key, ResourceVersion: current.ResourceVersion})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
}

func (e *globalSearchEnv) search(t *testing.T, requirements ...*resourcepb.Requirement) *resourcepb.ResourceSearchResponse {
	t.Helper()
	rsp, err := e.trySearch(requirements...)
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	return rsp
}

func (e *globalSearchEnv) trySearch(requirements ...*resourcepb.Requirement) (*resourcepb.ResourceSearchResponse, error) {
	return e.server.Search(e.ctx, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Namespace: globalSearchNamespace, Group: resource.GlobalSearchGroup, Resource: resource.GlobalSearchResource},
			Fields: requirements,
		},
		Fields:       []string{resource.SEARCH_FIELD_TITLE, resource.SEARCH_FIELD_FOLDER},
		Limit:        100,
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	})
}

// waitFor searches until done holds. A failed search, such as a 503 while an
// index is built, is tried again.
func (e *globalSearchEnv) waitFor(t *testing.T, what string, done func(*resourcepb.ResourceSearchResponse) bool) {
	t.Helper()
	require.Eventually(t, func() bool {
		rsp, err := e.trySearch()
		return err == nil && rsp.Error == nil && done(rsp)
	}, 10*time.Second, 20*time.Millisecond, what)
}

func filter(field, value string) *resourcepb.Requirement {
	return &resourcepb.Requirement{Key: field, Operator: string(selection.In), Values: []string{value}}
}

// names gives each result as {resource}/{name}.
func names(rsp *resourcepb.ResourceSearchResponse) []string {
	out := make([]string, 0, len(rsp.Rows))
	for _, row := range rsp.Rows {
		out = append(out, row.Key.Resource+"/"+row.Key.Name)
	}
	return out
}

// titles gives each result's title, keyed as names does.
func titles(rsp *resourcepb.ResourceSearchResponse) map[string]string {
	column := slices.IndexFunc(rsp.Fields, func(f *resourcepb.ResourceSearchField) bool { return f.Name == resource.SEARCH_FIELD_TITLE })
	out := map[string]string{}
	for _, row := range rsp.Rows {
		for _, v := range row.Values {
			if int(v.FieldIndex) == column && len(v.StringValues) > 0 {
				out[row.Key.Resource+"/"+row.Key.Name] = v.StringValues[0]
			}
		}
	}
	return out
}

// paths gives each folder path as "name:title", or "name!" for a detached folder.
func paths(rsp *resourcepb.ResourceSearchResponse) map[string][]string {
	out := map[string][]string{}
	for name, path := range rsp.FolderPaths {
		for _, f := range path.Folders {
			if f.Detached {
				out[name] = append(out[name], f.Name+"!")
			} else {
				out[name] = append(out[name], f.Name+":"+f.Title)
			}
		}
	}
	return out
}

func kindOf(gr schema.GroupResource) string {
	switch gr {
	case globalDashboards:
		return "Dashboard"
	case globalFolders:
		return "Folder"
	default:
		return "Playlist"
	}
}

// globalSearchManifests opts dashboards, playlists and, unless left out,
// folders into global search.
func globalSearchManifests(withFolders bool) []*app.ManifestData {
	yes := true
	manifest := func(gr schema.GroupResource) *app.ManifestData {
		return &app.ManifestData{Group: gr.Group, Versions: []app.ManifestVersion{{Name: "v1", Kinds: []app.ManifestVersionKind{{
			Kind: kindOf(gr), Plural: kindOf(gr) + "s", Scope: "Namespaced",
			Search: &app.ManifestVersionKindSearch{Global: &yes},
		}}}}}
	}
	manifests := []*app.ManifestData{manifest(globalDashboards), manifest(globalPlaylists)}
	if withFolders {
		manifests = append(manifests, manifest(globalFolders))
	}
	return manifests
}

// globalSearchAccess allows everything but the folders it denies. It checks the
// results of dashboards and folders only, so global search leaves playlists out.
type globalSearchAccess struct {
	mu     sync.Mutex
	denied []string
}

func (a *globalSearchAccess) deny(folder string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.denied = append(a.denied, folder)
}

func (a *globalSearchAccess) allowed(gr schema.GroupResource, name string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return gr != globalFolders || !slices.Contains(a.denied, name)
}

func (a *globalSearchAccess) IsCompatibleWithRBAC(group, resource string) bool {
	return schema.GroupResource{Group: group, Resource: resource} != globalPlaylists
}

func (a *globalSearchAccess) Check(_ context.Context, _ claims.AuthInfo, req claims.CheckRequest, _ string) (claims.CheckResponse, error) {
	return claims.CheckResponse{Allowed: a.allowed(schema.GroupResource{Group: req.Group, Resource: req.Resource}, req.Name)}, nil
}

func (a *globalSearchAccess) Compile(_ context.Context, _ claims.AuthInfo, req claims.ListRequest) (claims.ItemChecker, claims.Zookie, error) {
	gr := schema.GroupResource{Group: req.Group, Resource: req.Resource}
	return func(name, _ string) bool { return a.allowed(gr, name) }, claims.NoopZookie{}, nil
}

func (a *globalSearchAccess) BatchCheck(_ context.Context, _ claims.AuthInfo, req claims.BatchCheckRequest) (claims.BatchCheckResponse, error) {
	results := make(map[string]claims.BatchCheckResult, len(req.Checks))
	for _, c := range req.Checks {
		results[c.CorrelationID] = claims.BatchCheckResult{Allowed: a.allowed(schema.GroupResource{Group: c.Group, Resource: c.Resource}, c.Name)}
	}
	return claims.BatchCheckResponse{Results: results}, nil
}

// droppingWatchBackend drops the write notifications of the names it is told
// to, as a lost message on the bus would.
type droppingWatchBackend struct {
	resource.StorageBackend
	mu      sync.Mutex
	dropped []string
}

func (d *droppingWatchBackend) drop(name string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.dropped = append(d.dropped, name)
}

func (d *droppingWatchBackend) WatchWriteEvents(ctx context.Context) (<-chan *resource.WrittenEvent, error) {
	in, err := d.StorageBackend.WatchWriteEvents(ctx)
	if err != nil {
		return nil, err
	}
	out := make(chan *resource.WrittenEvent, 100)
	go func() {
		defer close(out)
		for event := range in {
			d.mu.Lock()
			skip := event.Key != nil && slices.Contains(d.dropped, event.Key.Name)
			d.mu.Unlock()
			if skip {
				continue
			}
			select {
			case out <- event:
			case <-ctx.Done():
				return
			}
		}
	}()
	return out, nil
}
