package provisioning

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/rest"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_RepositoryStats(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "repository-stats-subresource"

	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json":   "dashboard1.json",
			"testdata/text-options.json": "folder/dashboard2.json",
		},
	})
	helper.RequireRepoDashboardCount(t, repo, 2)
	helper.RequireRepoFolderCount(t, repo, 2)

	expected := []provisioning.ResourceCount{
		{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2},
		{Group: "folder.grafana.app", Resource: "folders", Count: 2},
	}

	stats := &provisioning.ResourceStats{}
	result := helper.AdminREST.Get().
		Namespace("default").
		Resource("repositories").
		Name(repo).
		SubResource("stats").
		Do(t.Context())
	require.NoError(t, result.Error(), "admin should be able to GET repository stats")
	require.NoError(t, result.Into(stats))

	require.Len(t, stats.Managed, 1, "exactly one managed entry, for the named repository")
	require.Equal(t, utils.ManagerKindRepo, stats.Managed[0].Kind)
	require.Equal(t, repo, stats.Managed[0].Identity)
	require.ElementsMatch(t, expected, stats.Managed[0].Stats)
	require.Empty(t, stats.Instance, "instance totals are a namespace concept")
	require.Empty(t, stats.Unmanaged, "unmanaged totals are a namespace concept")

	t.Run("counts match the namespace route's entry for the same repository", func(t *testing.T) {
		namespaceStats := &provisioning.ResourceStats{}
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("stats").
			Do(t.Context())
		require.NoError(t, result.Error())
		require.NoError(t, result.Into(namespaceStats))

		var found bool
		for _, manager := range namespaceStats.Managed {
			if manager.Kind == utils.ManagerKindRepo && manager.Identity == repo {
				found = true
				require.ElementsMatch(t, stats.Managed[0].Stats, manager.Stats)
			}
		}
		require.True(t, found, "the namespace route should report the repository")
	})

	t.Run("the sync writes status.stats from the same counts", func(t *testing.T) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repo, metav1.GetOptions{})
		require.NoError(t, err)

		repository := &provisioning.Repository{}
		require.NoError(t, runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, repository))
		require.ElementsMatch(t, stats.Managed[0].Stats, repository.Status.Stats)
	})

	t.Run("a repository the index counts nothing for is not found", func(t *testing.T) {
		var statusCode int
		result := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name("repository-stats-does-not-exist").
			SubResource("stats").
			Do(t.Context()).StatusCode(&statusCode)

		require.Error(t, result.Error())
		require.Equal(t, http.StatusNotFound, statusCode)
		require.True(t, apierrors.IsNotFound(result.Error()), "error should be not found")
	})

	for name, client := range map[string]*rest.RESTClient{"editor": helper.EditorREST, "viewer": helper.ViewerREST} {
		t.Run(name+" cannot GET repository stats", func(t *testing.T) {
			var statusCode int
			result := client.Get().
				Namespace("default").
				Resource("repositories").
				Name(repo).
				SubResource("stats").
				Do(t.Context()).StatusCode(&statusCode)

			require.Error(t, result.Error())
			require.Equal(t, http.StatusForbidden, statusCode)
			require.True(t, apierrors.IsForbidden(result.Error()), "error should be forbidden")
		})
	}
}
