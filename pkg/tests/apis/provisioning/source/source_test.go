package source

import (
	"net/http"
	"net/http/httptest"
	"path"
	"strings"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const (
	sourceID = "stacks-1"
	token    = "source-token"
)

// callLog counts the requests that reach the source, keyed by endpoint.
type callLog struct {
	mu     sync.Mutex
	counts map[string]int
}

func (c *callLog) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		endpoint := "/"
		if parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, "/v1/sources/"), "/", 3); len(parts) > 1 {
			endpoint += parts[1]
		}
		c.mu.Lock()
		if c.counts == nil {
			c.counts = map[string]int{}
		}
		c.counts[endpoint]++
		c.mu.Unlock()
		next.ServeHTTP(w, r)
	})
}

func (c *callLog) count(endpoint string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.counts[endpoint]
}

func (c *callLog) reset() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.counts = nil
}

func startSource(t *testing.T, tier sourceserver.Tier) (*sourceserver.Server, string, *callLog) {
	t.Helper()
	return startSourceWith(t, sourceserver.Options{Tier: tier})
}

func startSourceWith(t *testing.T, opts sourceserver.Options) (*sourceserver.Server, string, *callLog) {
	t.Helper()
	opts.ID = sourceID
	if opts.Token == "" {
		opts.Token = token
	}
	srv := sourceserver.New(opts)
	calls := &callLog{}
	ts := httptest.NewServer(calls.wrap(srv.Handler()))
	t.Cleanup(ts.Close)
	return srv, ts.URL + "/v1/sources/" + sourceID, calls
}

func sourceRepo(name, url string, workflows ...any) *unstructured.Unstructured {
	if workflows == nil {
		workflows = []any{}
	}
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Repository",
		"metadata":   map[string]any{"name": name},
		"spec": map[string]any{
			"title":     name,
			"type":      "source",
			"workflows": workflows,
			"sync":      map[string]any{"enabled": true, "target": "folderless", "intervalSeconds": int64(60)},
			"source":    map[string]any{"url": url},
		},
		"secure": map[string]any{"token": map[string]any{"create": token}},
	}}
}

// requireSyncedRef is the readiness contract: a source is applied once the repository
// reports a successful sync at the revision the source published.
func requireSyncedRef(t *testing.T, h *common.ProvisioningTestHelper, name, revision string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		state, _, _ := unstructured.NestedString(repo.Object, "status", "sync", "state")
		ref, _, _ := unstructured.NestedString(repo.Object, "status", "sync", "lastRef")
		assert.Equal(c, "success", state)
		assert.Equal(c, revision, ref)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "repository %s never reported a sync at %s", name, revision)
}

// withFolders adds the _folder.json that every directory of a tree needs.
func withFolders(t *testing.T, repoName string, files map[string][]byte) map[string][]byte {
	t.Helper()
	var dirs []string
	for p := range files {
		if dir := path.Dir(p); dir != "." {
			dirs = append(dirs, dir)
		}
	}
	for p, body := range common.FolderMetadataFiles(t, repoName, dirs...) {
		files[p] = body
	}
	return files
}

// editRepo applies a change to the spec (and secure values) of a repository object.
func editRepo(obj *unstructured.Unstructured, edit func(spec, secure map[string]any)) *unstructured.Unstructured {
	secure, _ := obj.Object["secure"].(map[string]any)
	if secure == nil {
		secure = map[string]any{}
		obj.Object["secure"] = secure
	}
	edit(obj.Object["spec"].(map[string]any), secure)
	return obj
}

// updateRepo saves a repository and waits until the controller has seen the new spec,
// since a job started before that would still run with the old one.
func updateRepo(t *testing.T, h *common.ProvisioningTestHelper, obj *unstructured.Unstructured) {
	t.Helper()
	updated, err := h.Repositories.Resource.Update(t.Context(), obj, metav1.UpdateOptions{})
	require.NoError(t, err)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(t.Context(), updated.GetName(), metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		observed, _, _ := unstructured.NestedInt64(repo.Object, "status", "observedGeneration")
		assert.GreaterOrEqual(c, observed, repo.GetGeneration())
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "the controller never observed the update")
}

// requireManaging waits for the repository to report the resources it manages,
// which is what makes an empty tree a prune rather than a first sync.
func requireManaging(t *testing.T, h *common.ProvisioningTestHelper, name string) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repo, err := h.Repositories.Resource.Get(t.Context(), name, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		stats, _, _ := unstructured.NestedSlice(repo.Object, "status", "stats")
		assert.NotEmpty(c, stats, "repository %s has not reported any managed resources", name)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
}

func titles(items []unstructured.Unstructured) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		title, _, _ := unstructured.NestedString(item.Object, "spec", "title")
		out = append(out, title)
	}
	return out
}

func TestIntegrationSource_SyncsDesiredState(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "cloud"

	srv, url, calls := startSource(t, sourceserver.TierCompare)
	r1 := srv.Publish(withFolders(t, repoName, map[string][]byte{
		"dashboards/team/a.json": common.DashboardJSON("src-dash-a", "A", 1),
		"dashboards/team/b.json": common.DashboardJSON("src-dash-b", "B", 1),
	}))

	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)

	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	managed := helper.RequireRepoDashboardCount(t, repoName, 2)
	assert.ElementsMatch(t, []string{"A", "B"}, titles(managed))
	requireSyncedRef(t, helper, repoName, r1)

	t.Run("a change is applied incrementally through compare", func(t *testing.T) {
		r2 := srv.Publish(withFolders(t, repoName, map[string][]byte{
			"dashboards/team/a.json": common.DashboardJSON("src-dash-a", "A updated", 2),
			"dashboards/team/c.json": common.DashboardJSON("src-dash-c", "C", 1),
		}))
		calls.reset()

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		managed := helper.RequireRepoDashboardCount(t, repoName, 2)
		assert.ElementsMatch(t, []string{"A updated", "C"}, titles(managed), "b was deleted, a updated, c created")
		assert.Positive(t, calls.count("/compare"), "the diff came from the source")
		requireSyncedRef(t, helper, repoName, r2)
	})

	t.Run("a file that disappears from the source is deleted", func(t *testing.T) {
		r3 := srv.Publish(withFolders(t, repoName, map[string][]byte{
			"dashboards/team/c.json": common.DashboardJSON("src-dash-c", "C", 1),
		}))
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		managed := helper.RequireRepoDashboardCount(t, repoName, 1)
		assert.Equal(t, []string{"C"}, titles(managed))
		requireSyncedRef(t, helper, repoName, r3)
	})
}

func TestIntegrationSource_FullSyncWithoutRevisions(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "tree-only"

	srv, url, _ := startSource(t, sourceserver.TierTree)
	srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("tree-dash-a", "A", 1)})

	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)

	// Without revisions there is no lastRef to wait for, and every sync is a full one.
	helper.SyncAndWait(t, repoName, nil)
	helper.RequireRepoDashboardCount(t, repoName, 1)

	srv.Publish(map[string][]byte{
		"a.json": common.DashboardJSON("tree-dash-a", "A", 1),
		"b.json": common.DashboardJSON("tree-dash-b", "B", 1),
	})
	helper.SyncAndWait(t, repoName, nil)
	helper.RequireRepoDashboardCount(t, repoName, 2)
}
