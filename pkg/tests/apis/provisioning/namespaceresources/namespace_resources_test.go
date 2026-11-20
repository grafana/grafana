package namespaceresources

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/rest"

	foldersV1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const dashboardAPIVersion = "dashboard.grafana.app/v1"

// resourceKey identifies one row independently of the order it came back in.
type resourceKey struct {
	group    string
	resource string
	name     string
}

func keysOf(items []provisioning.ResourceListItem) map[resourceKey]provisioning.ResourceListItem {
	out := make(map[resourceKey]provisioning.ResourceListItem, len(items))
	for _, item := range items {
		out[resourceKey{item.Group, item.Resource, item.Name}] = item
	}
	return out
}

// listNamespace reads one page of the namespace resources route.
func listNamespace(t *testing.T, client *rest.RESTClient, namespace string, params map[string]string) (*provisioning.ResourceList, error) {
	t.Helper()
	req := client.Get().Namespace(namespace).Resource("resources")
	for key, value := range params {
		req = req.Param(key, value)
	}
	list := &provisioning.ResourceList{}
	if err := req.Do(t.Context()).Into(list); err != nil {
		return nil, err
	}
	return list, nil
}

// listNamespaceAll pages through the whole list, so paging is exercised by every caller
// that needs a complete set.
func listNamespaceAll(t *testing.T, helper *common.ProvisioningTestHelper, params map[string]string) []provisioning.ResourceListItem {
	t.Helper()
	page := map[string]string{}
	for key, value := range params {
		page[key] = value
	}
	var items []provisioning.ResourceListItem
	for range 20 {
		list, err := listNamespace(t, helper.AdminREST, helper.Namespace, page)
		require.NoError(t, err)
		items = append(items, list.Items...)
		if list.Continue == "" {
			return items
		}
		page["continue"] = list.Continue
	}
	t.Fatal("namespace resource list did not terminate within 20 pages")
	return nil
}

func TestIntegrationProvisioning_NamespaceResources(t *testing.T) {
	helper := sharedHelper(t)
	const repo = "namespace-resources"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "instance",
		Copies: map[string]string{
			"../testdata/all-panels.json":    "all-panels.json",
			"../testdata/timeline-demo.json": "timeline-demo.json",
		},
	})
	helper.RequireDashboards(t, "n1jR8vnnz", "mIJjFy8Kz")

	unmanagedFolder, err := helper.Folders.Resource.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": foldersV1.FolderResourceInfo.GroupVersion().String(),
		"kind":       foldersV1.FolderResourceInfo.GroupVersionKind().Kind,
		"metadata":   map[string]any{"generateName": "unmanaged-folder-"},
		"spec":       map[string]any{"title": "Unmanaged folder"},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)

	unmanagedDashboard, err := helper.DashboardsV1.Resource.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": dashboardAPIVersion,
		"kind":       "Dashboard",
		"metadata": map[string]any{
			"generateName": "unmanaged-dashboard-",
			"annotations":  map[string]any{utils.AnnoKeyFolder: unmanagedFolder.GetName()},
		},
		"spec": map[string]any{"title": "Unmanaged dashboard", "schemaVersion": 41},
	}}, metav1.CreateOptions{})
	require.NoError(t, err)

	t.Run("managed=true matches the repository's own resource list", func(t *testing.T) {
		repoList := &provisioning.ResourceList{}
		require.NoError(t, helper.AdminREST.Get().
			Namespace(helper.Namespace).
			Resource("repositories").
			Name(repo).
			SubResource("resources").
			Do(t.Context()).
			Into(repoList))
		require.NotEmpty(t, repoList.Items)

		// The repository's own list reports path, hash and time, so the namespace list is
		// asked for them too; otherwise the two could not be compared row for row.
		params := map[string]string{"manager.kind": "repo", "manager.id": repo, "fields": "path,hash,time"}
		var items []provisioning.ResourceListItem
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			items = listNamespaceAll(t, helper, params)
			assert.Len(c, items, len(repoList.Items))
		}, 30*time.Second, 200*time.Millisecond, "namespace list should report every resource the repository manages")

		want := keysOf(repoList.Items)
		got := keysOf(items)
		require.Equal(t, len(want), len(got))
		for key, wantItem := range want {
			gotItem, ok := got[key]
			require.True(t, ok, "namespace list is missing %v", key)
			assert.Equal(t, wantItem.Path, gotItem.Path, "path for %v", key)
			assert.Equal(t, wantItem.Hash, gotItem.Hash, "hash for %v", key)
			assert.Equal(t, wantItem.Title, gotItem.Title, "title for %v", key)
			assert.Equal(t, wantItem.Folder, gotItem.Folder, "folder for %v", key)
			require.NotNil(t, gotItem.Manager, "manager for %v", key)
			assert.Equal(t, utils.ManagerKindRepo, gotItem.Manager.Kind)
			assert.Equal(t, repo, gotItem.Manager.Identity)
		}
	})

	t.Run("managed=false reports the unmanaged resources and nothing else", func(t *testing.T) {
		var items []provisioning.ResourceListItem
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			items = listNamespaceAll(t, helper, map[string]string{"managed": "false"})
			// Both, and in this retry: the folder and the dashboard are indexed
			// independently, so waiting for one says nothing about the other.
			got := keysOf(items)
			assert.Contains(c, got, resourceKey{"dashboard.grafana.app", "dashboards", unmanagedDashboard.GetName()})
			assert.Contains(c, got, resourceKey{"folder.grafana.app", "folders", unmanagedFolder.GetName()})
		}, 30*time.Second, 200*time.Millisecond, "the unmanaged fixtures should be indexed")

		got := keysOf(items)
		for key, item := range got {
			require.Nil(t, item.Manager, "unmanaged row %v must carry no manager", key)
			assert.Empty(t, item.Path, "path is a managed-only property")
			assert.Empty(t, item.Hash, "hash is a managed-only property")
		}
		assert.Equal(t, unmanagedFolder.GetName(), got[resourceKey{"dashboard.grafana.app", "dashboards", unmanagedDashboard.GetName()}].Folder)
	})

	// Stats is the other answer to "what is in this namespace"; the two must agree, or the
	// frontend cannot tell a filtered list from an incomplete one.
	t.Run("managed and unmanaged account for the instance stats, kind for kind", func(t *testing.T) {
		stats := &provisioning.ResourceStats{}
		require.NoError(t, helper.AdminREST.Get().
			Namespace(helper.Namespace).
			Resource("stats").
			Do(t.Context()).
			Into(stats))
		require.NotEmpty(t, stats.Instance)

		counted := map[resourceKey]int{}
		for _, managed := range []string{"true", "false"} {
			for _, item := range listNamespaceAll(t, helper, map[string]string{"managed": managed}) {
				counted[resourceKey{group: item.Group, resource: item.Resource}]++
			}
		}
		// Both kinds this fixture populates must take part, so the comparison below
		// cannot pass by covering nothing.
		require.Contains(t, counted, resourceKey{group: "dashboard.grafana.app", resource: "dashboards"})
		require.Contains(t, counted, resourceKey{group: "folder.grafana.app", resource: "folders"})

		for _, count := range stats.Instance {
			key := resourceKey{group: count.Group, resource: count.Resource}
			if _, listed := counted[key]; !listed {
				// Stats covers every kind in unified storage; the list covers the
				// provisionable ones.
				continue
			}
			assert.Equal(t, int(count.Count), counted[key], "managed plus unmanaged should account for %s/%s", count.Group, count.Resource)
		}
	})

	t.Run("paging returns every row exactly once", func(t *testing.T) {
		all := listNamespaceAll(t, helper, nil)
		paged := listNamespaceAll(t, helper, map[string]string{"limit": "1"})
		assert.Equal(t, keysOf(all), keysOf(paged), "a one-row page size must not change the result set")
		// keysOf collapses duplicates, so the count is what rules out a row served twice.
		assert.Len(t, paged, len(all), "a one-row page size must not change how many rows come back")
		assert.Equal(t, len(keysOf(paged)), len(paged), "a row must not appear on more than one page")
	})

	t.Run("a write between pages neither duplicates nor drops the rows already paged", func(t *testing.T) {
		before := keysOf(listNamespaceAll(t, helper, map[string]string{"managed": "false"}))
		require.NotEmpty(t, before)

		page := map[string]string{"managed": "false", "limit": "1"}
		var paged []provisioning.ResourceListItem
		written := false
		finished := false
		pages := 0
		for range 50 {
			list, err := listNamespace(t, helper.AdminREST, helper.Namespace, page)
			require.NoError(t, err)
			pages++
			paged = append(paged, list.Items...)
			if !written {
				created, err := helper.DashboardsV1.Resource.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": dashboardAPIVersion,
					"kind":       "Dashboard",
					"metadata":   map[string]any{"generateName": "paging-write-"},
					"spec":       map[string]any{"title": "Written between pages", "schemaVersion": 41},
				}}, metav1.CreateOptions{})
				require.NoError(t, err)
				// Create returns once storage accepts it, but the walk reads the search
				// index. Without waiting for the index the remaining pages can all be
				// read before the write is visible, and nothing is exercised.
				newRow := resourceKey{"dashboard.grafana.app", "dashboards", created.GetName()}
				require.EventuallyWithT(t, func(c *assert.CollectT) {
					found := listNamespaceAll(t, helper, map[string]string{"managed": "false"})
					assert.Contains(c, keysOf(found), newRow)
				}, 30*time.Second, 200*time.Millisecond, "the dashboard written mid-walk should be indexed")
				written = true
			}
			if list.Continue == "" {
				finished = true
				break
			}
			page["continue"] = list.Continue
		}
		require.True(t, finished, "paging across a concurrent write did not terminate")
		// Otherwise the write landed after the only page and nothing was interleaved.
		require.Greater(t, pages, 1, "the walk must span more than one page to interleave a write")

		got := keysOf(paged)
		assert.Equal(t, len(got), len(paged), "a row must not appear on more than one page")
		for key := range before {
			assert.Contains(t, got, key, "%v was dropped by a write made mid-walk", key)
		}
	})

	// The endpoint's point is that the server owns the kind set, so it must report the
	// configured kinds and only those — settings is where that set is published.
	t.Run("only the registered supported kinds are listed", func(t *testing.T) {
		settings := &provisioning.RepositoryViewList{}
		require.NoError(t, helper.AdminREST.Get().
			Namespace(helper.Namespace).
			Resource("settings").
			Do(t.Context()).
			Into(settings))
		require.NotEmpty(t, settings.AvailableResources)

		registered := map[string]bool{}
		for _, r := range settings.AvailableResources {
			registered[r.Group] = true
		}

		listed := map[string]bool{}
		for _, item := range listNamespaceAll(t, helper, nil) {
			listed[item.Group] = true
		}
		require.NotEmpty(t, listed)
		for group := range listed {
			assert.True(t, registered[group], "group %q is listed but is not a configured provisioning resource", group)
		}
	})

	t.Run("a filter naming a kind provisioning does not serve is refused", func(t *testing.T) {
		_, err := listNamespace(t, helper.AdminREST, helper.Namespace, map[string]string{
			"group":    "secret.grafana.app",
			"resource": "securevalues",
		})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got: %v", err)
	})

	t.Run("a filter on one kind returns only that kind", func(t *testing.T) {
		items := listNamespaceAll(t, helper, map[string]string{"group": "folder.grafana.app", "resource": "folders"})
		require.NotEmpty(t, items)
		for _, item := range items {
			assert.Equal(t, "folder.grafana.app", item.Group)
			assert.Equal(t, "folders", item.Resource)
		}
	})

	t.Run("an unparseable parameter is rejected", func(t *testing.T) {
		for name, params := range map[string]map[string]string{
			"unknown projection":   {"fields": "title"},
			"malformed continue":   {"continue": "not-a-token"},
			"contradictory filter": {"managed": "false", "manager.id": repo},
			// A dropped filter answers a different question from the one asked.
			"misspelled filter": {"manage": "false"},
		} {
			t.Run(name, func(t *testing.T) {
				_, err := listNamespace(t, helper.AdminREST, helper.Namespace, params)
				require.Error(t, err)
				require.True(t, apierrors.IsBadRequest(err), "expected a bad request, got: %v", err)
			})
		}
	})

	t.Run("an editor and a viewer are denied", func(t *testing.T) {
		for name, client := range map[string]*rest.RESTClient{
			"editor": helper.EditorREST,
			"viewer": helper.ViewerREST,
		} {
			t.Run(name, func(t *testing.T) {
				var statusCode int
				err := client.Get().
					Namespace(helper.Namespace).
					Resource("resources").
					Do(t.Context()).
					StatusCode(&statusCode).
					Error()
				require.Error(t, err)
				assert.Equal(t, http.StatusForbidden, statusCode)
			})
		}
	})
}
