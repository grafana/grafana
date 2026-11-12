package resourcelister

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_ResourceListerFromAPI(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "api-resource-lister"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"../testdata/all-panels.json":   "dashboard1.json",
			"../testdata/text-options.json": "nested/dashboard2.json",
		},
	})
	helper.RequireRepoDashboardCount(t, repo, 2)

	lister := resources.NewResourceListerFromProvisioningAPI(helper.AdminREST)

	t.Run("lists what the repository manages", func(t *testing.T) {
		list, err := lister.List(t.Context(), helper.Namespace, repo, resources.ListOptions{})
		require.NoError(t, err)

		paths := make([]string, 0, len(list.Items))
		for _, item := range list.Items {
			paths = append(paths, item.Path)
		}
		require.Subset(t, paths, []string{"dashboard1.json", "nested/dashboard2.json"})
		require.Equal(t, directList(t, helper, repo).Items, list.Items)
	})

	t.Run("a page round-trips through the continue token", func(t *testing.T) {
		whole, err := lister.List(t.Context(), helper.Namespace, repo, resources.ListOptions{})
		require.NoError(t, err)
		require.Greater(t, len(whole.Items), 1, "needs more than one item to page")

		var paged []provisioning.ResourceListItem
		token := ""
		for {
			page, err := lister.List(t.Context(), helper.Namespace, repo, resources.ListOptions{Limit: 1, Continue: token})
			require.NoError(t, err)
			require.Len(t, page.Items, 1)
			paged = append(paged, page.Items...)
			if token = page.Continue; token == "" {
				break
			}
		}
		require.Equal(t, whole.Items, paged, "the pages must be the whole list, in order, once each")
	})

	// The route answers from the index without resolving the repository, so a name that does not
	// exist lists nothing instead of failing — the same answer the index reader gives in process.
	t.Run("an unknown repository lists nothing", func(t *testing.T) {
		list, err := lister.List(t.Context(), helper.Namespace, "no-such-repo", resources.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, list.Items)
	})

	// A read the server refused must not arrive as that same empty list: the sync diffs against it,
	// so nothing listed means everything the repository manages is an orphan.
	t.Run("a refused read is an error, not an empty list", func(t *testing.T) {
		_, err := resources.NewResourceListerFromProvisioningAPI(helper.ViewerREST).
			List(t.Context(), helper.Namespace, repo, resources.ListOptions{})
		require.True(t, apierrors.IsForbidden(err), "got %v", err)
		require.True(t, apierrors.IsForbidden(resource.StatusErrorFromGRPC(err)), "got %v", err)
	})

	t.Run("the counts are not read over HTTP yet", func(t *testing.T) {
		_, nsErr := lister.Stats(t.Context(), helper.Namespace)
		require.ErrorContains(t, nsErr, "cannot read stats yet")

		_, repoErr := lister.RepositoryStats(t.Context(), helper.Namespace, repo)
		require.ErrorContains(t, repoErr, "cannot read stats yet")
	})

	// The reader is for callers outside the process; the server still answers its own routes from
	// the index, so selecting the mode must leave sync and the cleanup finalizer working.
	t.Run("the server itself still reconciles a delete", func(t *testing.T) {
		require.NoError(t, helper.Repositories.Resource.Delete(t.Context(), repo, metav1.DeleteOptions{}))
		helper.WaitForRepositoryDeleted(t, repo)
		helper.RequireRepoDashboardCount(t, repo, 0)
	})
}

func directList(t *testing.T, helper *common.ProvisioningTestHelper, repo string) *provisioning.ResourceList {
	t.Helper()
	list := &provisioning.ResourceList{}
	require.NoError(t, helper.AdminREST.Get().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repo).
		SubResource("resources").
		Do(t.Context()).
		Into(list))
	return list
}
