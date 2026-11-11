package apislister

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const repo = "apis-lister-repo"

// The whole pipeline — sync, the resources subresource, stats and the deletion finalizers — runs
// without the managed-object index: everything is read through the groups that serve each kind.
func TestIntegrationProvisioning_APIResourceLister(t *testing.T) {
	helper := sharedHelper(t)

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "dashboard1.json",
			"../testdata/text-options.json": "folder/dashboard2.json",
		},
	})
	dashboards := helper.RequireRepoDashboardCount(t, repo, 2)

	t.Run("resources subresource lists what the repository manages", func(t *testing.T) {
		list := &provisioning.ResourceList{}
		err := helper.AdminREST.Get().
			Namespace(helper.Namespace).
			Resource("repositories").
			Name(repo).
			SubResource("resources").
			Do(t.Context()).
			Into(list)
		require.NoError(t, err, "should list repository resources")

		byPath := map[string]provisioning.ResourceListItem{}
		for _, item := range list.Items {
			byPath[item.Path] = item
		}
		for _, dashboard := range dashboards {
			meta, err := utils.MetaAccessor(&dashboard)
			require.NoError(t, err)
			source, _ := meta.GetSourceProperties()
			item, ok := byPath[source.Path]
			require.True(t, ok, "dashboard at %q should be listed", source.Path)
			require.Equal(t, "dashboard.grafana.app", item.Group)
			require.Equal(t, "dashboards", item.Resource)
			require.Equal(t, dashboard.GetName(), item.Name)
			require.Equal(t, source.Checksum, item.Hash, "the checksum full sync compares against")
			require.Equal(t, meta.FindTitle(""), item.Title)
		}

		folders := helper.ListRepoFolders(t, repo)
		require.Len(t, list.Items, len(dashboards)+len(folders),
			"every managed resource is listed exactly once")
	})

	t.Run("stats count managed, instance and unmanaged resources", func(t *testing.T) {
		unmanaged := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
		_, err := helper.DashboardsV1.Resource.Create(t.Context(), unmanaged, metav1.CreateOptions{})
		require.NoError(t, err, "should create an unmanaged dashboard")

		stats := &provisioning.ResourceStats{}
		err = helper.AdminREST.Get().
			Namespace(helper.Namespace).
			Resource("stats").
			Do(t.Context()).
			Into(stats)
		require.NoError(t, err, "should get namespace stats")

		require.Equal(t, int64(2), countFor(stats.Managed, repo, "dashboards"),
			"both dashboards are reported as managed by the repository")
		require.GreaterOrEqual(t, countIn(stats.Instance, "dashboards"), int64(3),
			"instance counts the unmanaged dashboard too")
		require.GreaterOrEqual(t, countIn(stats.Unmanaged, "dashboards"), int64(1),
			"the unmanaged dashboard is what a full export would take over")
	})

	t.Run("deleting the repository releases what it managed", func(t *testing.T) {
		require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
		// The finalizers list the repository's resources through the same lister.
		helper.RequireRepoDashboardCount(t, repo, 0)
	})
}

func countFor(managed []provisioning.ManagerStats, identity, resource string) int64 {
	for _, manager := range managed {
		if manager.Kind == utils.ManagerKindRepo && manager.Identity == identity {
			return countIn(manager.Stats, resource)
		}
	}
	return 0
}

func countIn(counts []provisioning.ResourceCount, resource string) int64 {
	for _, count := range counts {
		if count.Resource == resource {
			return count.Count
		}
	}
	return 0
}
