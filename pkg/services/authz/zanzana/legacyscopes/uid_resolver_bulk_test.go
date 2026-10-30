package legacyscopes

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	clientrest "k8s.io/client-go/rest"
)

type bulkRESTConfig func(context.Context) (*clientrest.Config, error)

func (f bulkRESTConfig) GetRestConfig(ctx context.Context) (*clientrest.Config, error) { return f(ctx) }
func bulkHTTPResolver(t *testing.T, handler http.HandlerFunc) *UIDResolver {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return NewUIDResolver(bulkRESTConfig(func(context.Context) (*clientrest.Config, error) {
		return &clientrest.Config{Host: server.URL, QPS: -1}, nil
	}))
}
func writeUIDList(w http.ResponseWriter, continuation string, objects ...*unstructured.Unstructured) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion": "iam.grafana.app/v0alpha1", "kind": "UserList", "metadata": map[string]string{"continue": continuation}, "items": objects})
}
func userIDObject(namespace, name string, id int64) *unstructured.Unstructured {
	return iamObject(userGVR.GroupVersion().WithKind("User"), namespace, name, id)
}

func TestBulkUIDResolutionPaginationAndMissingObjects(t *testing.T) {
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	var mu sync.Mutex
	calls := map[string]int{}
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		key := req.URL.Path + "?" + req.URL.Query().Get("continue")
		mu.Lock()
		calls[key]++
		mu.Unlock()
		if strings.HasSuffix(req.URL.Path, "/users") {
			require.Equal(t, "1000", req.URL.Query().Get("limit"))
			if req.URL.Query().Get("continue") == "" {
				writeUIDList(w, "next", userIDObject(ns.Value, "first", 1), userIDObject(ns.Value, "unrequested", 99))
			} else {
				writeUIDList(w, "", userIDObject(ns.Value, "second", 2), userIDObject(ns.Value, "no-id", 0))
			}
			return
		}
		if strings.HasSuffix(req.URL.Path, "/new") {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(userIDObject(ns.Value, "new", 3))
			return
		}
		if strings.HasSuffix(req.URL.Path, "/no-id") {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(userIDObject(ns.Value, "no-id", 0))
			return
		}
		http.NotFound(w, req)
	})
	lists := []PermissionList{
		{Action: "users:read", Resource: "users", List: &authzv1.ListResponse{Items: []string{"first", "second", "new", "missing", "no-id"}}},
		{Action: "org.users:read", Resource: "users", List: &authzv1.ListResponse{Items: []string{"missing", "new", "no-id", "first"}}},
	}
	permissions, err := ResolvePermissions(t.Context(), ns.Value, "", r, lists)
	require.NoError(t, err)
	scopes := map[string]bool{}
	for _, p := range permissions {
		scopes[p.Scope] = true
	}
	for _, scope := range []string{"global.users:id:1", "global.users:id:2", "global.users:id:3", "users:id:1", "users:id:3", "users:uid:missing", "users:uid:no-id"} {
		require.True(t, scopes[scope], scope)
	}
	require.False(t, scopes["global.users:id:0"])
	// The bulk load also warms mappings not needed by the first permission request.
	ids, err := r.Prepare(t.Context(), ns, []string{"unrequested", "new", "first"}, nil)
	require.NoError(t, err)
	id, err := ids.GetUserIDByUID(t.Context(), ns, "unrequested")
	require.NoError(t, err)
	require.Equal(t, int64(99), id)
	mu.Lock()
	defer mu.Unlock()
	base := "/apis/iam.grafana.app/v0alpha1/namespaces/default/users"
	require.Equal(t, map[string]int{base + "?": 1, base + "?next": 1, base + "/new?": 1, base + "/missing?": 1, base + "/no-id?": 1}, calls)
}

func TestBulkUIDResolutionFailureDoesNotPublishPartialCache(t *testing.T) {
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	var healthy atomic.Bool
	var lists, gets atomic.Int64
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if !strings.HasSuffix(req.URL.Path, "/users") {
			gets.Add(1)
			http.NotFound(w, req)
			return
		}
		lists.Add(1)
		if req.URL.Query().Get("continue") == "" {
			writeUIDList(w, "next", userIDObject(ns.Value, "first", 1))
			return
		}
		if !healthy.Load() {
			http.Error(w, "unavailable", http.StatusInternalServerError)
			return
		}
		writeUIDList(w, "")
	})
	_, err := r.Prepare(t.Context(), ns, []string{"first", "missing"}, nil)
	require.ErrorContains(t, err, "list users scope IDs")
	require.Zero(t, gets.Load(), "a batch error must not turn into individual Gets")
	healthy.Store(true)
	ids, err := r.Prepare(t.Context(), ns, []string{"first"}, nil)
	require.NoError(t, err)
	id, err := ids.GetUserIDByUID(t.Context(), ns, "first")
	require.NoError(t, err)
	require.Equal(t, int64(1), id)
	require.Equal(t, int64(4), lists.Load(), "retry must reload every page, including the first")
	require.Zero(t, gets.Load())
}

func TestBulkUIDResolutionCoalescesNamespacesAndPreservesCancellation(t *testing.T) {
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	var lists atomic.Int64
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		lists.Add(1)
		once.Do(func() { close(started) })
		<-release
		writeUIDList(w, "", userIDObject(ns.Value, "first", 1))
	})
	cancelled, cancel := context.WithCancel(t.Context())
	defer cancel()
	first := make(chan error, 1)
	go func() { _, err := r.Prepare(cancelled, ns, []string{"first"}, nil); first <- err }()
	<-started
	const followers = 12
	var wg sync.WaitGroup
	for range followers {
		wg.Go(func() {
			ids, err := r.Prepare(t.Context(), ns, []string{"first"}, nil)
			require.NoError(t, err)
			if err == nil {
				id, err := ids.GetUserIDByUID(t.Context(), ns, "first")
				require.NoError(t, err)
				require.Equal(t, int64(1), id)
			}
		})
	}
	cancel()
	require.ErrorIs(t, <-first, context.Canceled)
	close(release)
	wg.Wait()
	require.Equal(t, int64(1), lists.Load())
}

func TestBulkUIDResolutionSeparatesNamespaces(t *testing.T) {
	var lists atomic.Int64
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		lists.Add(1)
		ns, id := "default", int64(1)
		if strings.Contains(req.URL.Path, "/stacks-2/") {
			ns, id = "stacks-2", 2
		}
		writeUIDList(w, "", userIDObject(ns, "same-uid", id))
	})
	for _, ns := range []types.NamespaceInfo{{Value: "default", OrgID: 1}, {Value: "stacks-2", OrgID: 1, StackID: 2}} {
		ids, err := r.Prepare(t.Context(), ns, []string{"same-uid"}, nil)
		require.NoError(t, err)
		id, err := ids.GetUserIDByUID(t.Context(), ns, "same-uid")
		require.NoError(t, err)
		want := int64(1)
		if ns.Value == "stacks-2" {
			want = 2
		}
		require.Equal(t, want, id)
	}
	require.Equal(t, int64(2), lists.Load())
}

func TestBulkUIDResolutionBoundsMissingGets(t *testing.T) {
	var active, peak, gets atomic.Int64
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if strings.HasSuffix(req.URL.Path, "/users") {
			writeUIDList(w, "")
			return
		}
		gets.Add(1)
		n := active.Add(1)
		defer active.Add(-1)
		for previous := peak.Load(); n > previous && !peak.CompareAndSwap(previous, n); previous = peak.Load() {
		}
		time.Sleep(10 * time.Millisecond)
		http.NotFound(w, req)
	})
	names := make([]string, 0, 25)
	for i := range 25 {
		names = append(names, fmt.Sprintf("missing-%d", i))
	}
	_, err := r.Prepare(t.Context(), types.NamespaceInfo{Value: "default", OrgID: 1}, names, nil)
	require.NoError(t, err)
	require.Equal(t, int64(len(names)), gets.Load())
	require.Greater(t, peak.Load(), int64(1))
	require.LessOrEqual(t, peak.Load(), int64(uidFallbackConcurrency))
}

func TestBulkUIDResolutionSkipsNonNumericScopes(t *testing.T) {
	resolver := bulkHTTPResolver(t, func(http.ResponseWriter, *http.Request) { t.Error("wildcards and UID scopes must not read IAM") })
	_, err := ResolvePermissions(t.Context(), "default", "", resolver, []PermissionList{
		{Action: "users:read", Resource: "users", List: &authzv1.ListResponse{All: true}},
		{Action: "teams:read", Resource: "teams", List: &authzv1.ListResponse{All: true}},
		{Action: "dashboards:read", Resource: "dashboards", List: &authzv1.ListResponse{Items: []string{"dashboard"}}},
	})
	require.NoError(t, err)
	cancelled, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = resolver.Prepare(cancelled, types.NamespaceInfo{Value: "default", OrgID: 1}, []string{"user"}, nil)
	require.True(t, errors.Is(err, context.Canceled))
}

func TestBulkUIDResolutionLargeNamespace(t *testing.T) {
	const population = 2105
	var lists, gets atomic.Int64
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if !strings.HasSuffix(req.URL.Path, "/users") {
			gets.Add(1)
			http.NotFound(w, req)
			return
		}
		lists.Add(1)
		start := 0
		if token := req.URL.Query().Get("continue"); token != "" {
			_, err := fmt.Sscanf(token, "page-%d", &start)
			require.NoError(t, err)
		}
		end := min(start+uidListPageSize, population)
		objects := make([]*unstructured.Unstructured, 0, end-start)
		for i := start; i < end; i++ {
			objects = append(objects, userIDObject("default", fmt.Sprintf("user-%d", i), int64(i+1)))
		}
		next := ""
		if end < population {
			next = fmt.Sprintf("page-%d", end)
		}
		writeUIDList(w, next, objects...)
	})
	names := make([]string, population)
	for i := range names {
		names[i] = fmt.Sprintf("user-%d", i)
	}
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	for range 2 {
		ids, err := r.Prepare(t.Context(), ns, names, nil)
		require.NoError(t, err)
		for i, name := range names {
			id, err := ids.GetUserIDByUID(t.Context(), ns, name)
			require.NoError(t, err)
			require.Equal(t, int64(i+1), id)
		}
	}
	require.Equal(t, int64(3), lists.Load())
	require.Zero(t, gets.Load())
	t.Logf("%d target UIDs, two requests: %d List pages, %d individual Gets", population, lists.Load(), gets.Load())
}

func TestBulkUIDResolutionSingleUncachedUIDLoadsNamespace(t *testing.T) {
	var lists, gets atomic.Int64
	r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
		if !strings.HasSuffix(req.URL.Path, "/users") {
			gets.Add(1)
			http.NotFound(w, req)
			return
		}
		lists.Add(1)
		require.Empty(t, req.URL.Query().Get("fieldSelector"))
		require.Empty(t, req.URL.Query().Get("labelSelector"))
		if req.URL.Query().Get("continue") == "" {
			writeUIDList(w, "next", userIDObject("default", "requested", 1))
			return
		}
		writeUIDList(w, "", userIDObject("default", "unrequested", 99))
	})
	ns := types.NamespaceInfo{Value: "default", OrgID: 1}
	ids, err := r.Prepare(t.Context(), ns, []string{"requested"}, nil)
	require.NoError(t, err)
	id, err := ids.GetUserIDByUID(t.Context(), ns, "requested")
	require.NoError(t, err)
	require.Equal(t, int64(1), id)
	require.Equal(t, int64(2), lists.Load(), "one uncached UID must still load every namespace page, even after finding the requested UID")

	ids, err = r.Prepare(t.Context(), ns, []string{"unrequested"}, nil)
	require.NoError(t, err)
	id, err = ids.GetUserIDByUID(t.Context(), ns, "unrequested")
	require.NoError(t, err)
	require.Equal(t, int64(99), id)
	require.Equal(t, int64(2), lists.Load(), "later requests reuse unrequested mappings from the namespace load")
	require.Zero(t, gets.Load())
}

func TestBulkUIDResolutionRequiresCollectionListAccess(t *testing.T) {
	for _, resource := range []string{"users", "teams"} {
		t.Run(resource, func(t *testing.T) {
			var lists, gets atomic.Int64
			r := bulkHTTPResolver(t, func(w http.ResponseWriter, req *http.Request) {
				if strings.HasSuffix(req.URL.Path, "/"+resource) {
					lists.Add(1)
					http.Error(w, "list forbidden", http.StatusForbidden)
					return
				}
				gets.Add(1)
				kind := "User"
				if resource == "teams" {
					kind = "Team"
				}
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(iamObject(userGVR.GroupVersion().WithKind(kind), "default", "target", 42))
			})
			action := "users:read"
			if resource == "teams" {
				action = "teams:read"
			}
			permissions, err := ResolvePermissions(t.Context(), "default", "", r, []PermissionList{
				{Resource: resource, Action: action, List: &authzv1.ListResponse{Items: []string{"target"}}},
			})
			require.Error(t, err)
			require.Empty(t, permissions, "a failed List must fail preparation rather than silently emit UID scopes")
			require.Equal(t, int64(1), lists.Load())
			require.Zero(t, gets.Load(), "a collection access error must not fan out into Gets")

			ns := types.NamespaceInfo{Value: "default", OrgID: 1}
			get := r.GetUserIDByUID
			if resource == "teams" {
				get = r.GetTeamIDByUID
			}
			id, err := get(t.Context(), ns, "target")
			require.NoError(t, err, "the previous individual-Get path works with this IAM access policy")
			require.Equal(t, int64(42), id)
			require.Equal(t, int64(1), gets.Load())
		})
	}
}
