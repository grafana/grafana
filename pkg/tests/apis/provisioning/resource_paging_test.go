package provisioning

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_ResourcesPaging(t *testing.T) {
	helper := sharedHelper(t)

	const repo = "resources-paging-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repo,
		SyncTarget: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json":    "dashboard1.json",
			"testdata/text-options.json":  "folder/dashboard2.json",
			"testdata/timeline-demo.json": "folder/dashboard3.json",
		},
	})
	helper.RequireRepoDashboardCount(t, repo, 3)
	helper.RequireRepoFolderCount(t, repo, 2)

	// The three dashboards, the repository root folder and the nested one.
	const total = 5

	// The list is served from the search index, which lags the sync that wrote the resources.
	var all []provisioning.ResourceListItem
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := listRepoResources(t, helper, repo, nil)
		if !assert.NoError(c, err) {
			return
		}
		if !assert.Len(c, list.Items, total) {
			return
		}
		assert.Empty(c, list.Continue, "a list without a limit carries no continue token")
		all = list.Items
	}, 30*time.Second, 100*time.Millisecond, "expected %d resources listed for repo %s", total, repo)

	for _, limit := range []int{1, 2, total} {
		t.Run(fmt.Sprintf("limit %d", limit), func(t *testing.T) {
			params := map[string]string{"limit": strconv.Itoa(limit)}
			var seen []provisioning.ResourceListItem
			for pages := 0; ; pages++ {
				require.Less(t, pages, total+1, "paging did not terminate")

				page, err := listRepoResources(t, helper, repo, params)
				require.NoError(t, err)
				require.LessOrEqual(t, len(page.Items), limit, "a page is never larger than the limit")

				seen = append(seen, page.Items...)
				if page.Continue == "" {
					break
				}
				params["continue"] = page.Continue
			}
			require.Equal(t, all, seen, "the pages hold the whole list, in order, without duplicates or gaps")
		})
	}

	t.Run("rejects an invalid limit", func(t *testing.T) {
		_, err := listRepoResources(t, helper, repo, map[string]string{"limit": "ten"})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})

	t.Run("rejects an undecodable continue token", func(t *testing.T) {
		_, err := listRepoResources(t, helper, repo, map[string]string{"continue": "not-a-token!"})
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
	})
}

// listRepoResources reads one page of the repository's managed resources.
func listRepoResources(t *testing.T, helper *common.ProvisioningTestHelper, repo string, params map[string]string) (*provisioning.ResourceList, error) {
	t.Helper()
	req := helper.AdminREST.Get().
		Namespace(helper.Namespace).
		Resource("repositories").
		Name(repo).
		SubResource("resources")
	for name, value := range params {
		req = req.Param(name, value)
	}

	list := &provisioning.ResourceList{}
	if err := req.Do(t.Context()).Into(list); err != nil {
		return nil, err
	}
	return list, nil
}
