package source

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationSource_EditsAreWrittenBack(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "editable"

	srv, url, _ := startSourceWith(t, sourceserver.Options{Tier: sourceserver.TierCompare, Writable: true})
	srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("edit-a", "A", 1)})

	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url, "write"), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	helper.RequireRepoDashboardCount(t, repoName, 1)

	files := helper.NewFilesClient(repoName)

	t.Run("a new dashboard is written to the source", func(t *testing.T) {
		resp := files.Post(t, "b.json", common.DashboardJSON("edit-b", "B", 1))
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())

		assert.Contains(t, srv.Files(), "b.json", "the source holds the file, not only Grafana")
		helper.RequireRepoDashboardCount(t, repoName, 2)
	})

	t.Run("an edit replaces the file at the source", func(t *testing.T) {
		resp := files.Put(t, "a.json", common.DashboardJSON("edit-a", "A edited", 2))
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())

		assert.Contains(t, string(srv.Files()["a.json"]), "A edited")
		assert.ElementsMatch(t, []string{"A edited", "B"}, titles(helper.RequireRepoDashboardCount(t, repoName, 2)))
	})

	t.Run("a delete removes the file from the source", func(t *testing.T) {
		resp := files.Delete(t, "b.json")
		require.Equal(t, http.StatusOK, resp.StatusCode, resp.BodyString())

		assert.NotContains(t, srv.Files(), "b.json")
		helper.RequireRepoDashboardCount(t, repoName, 1)
	})

	t.Run("the next sync has nothing left to undo and ends at the source's revision", func(t *testing.T) {
		common.SyncAndWait(t, helper, common.Repo(repoName), common.Incremental, common.Succeeded())

		titlesNow := titles(helper.RequireRepoDashboardCount(t, repoName, 1))
		assert.Equal(t, []string{"A edited"}, titlesNow)
		requireSyncedRef(t, helper, repoName, srv.Publish(srv.Files()))
	})
}

func TestIntegrationSource_ReadOnlyRepositoriesRefuseEdits(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "not-editable"

	// The source could be edited, but the repository does not enable the write workflow.
	srv, url, _ := startSourceWith(t, sourceserver.Options{Tier: sourceserver.TierCompare, Writable: true})
	srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("ro-a", "A", 1)})

	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())

	resp := helper.NewFilesClient(repoName).Post(t, "b.json", common.DashboardJSON("ro-b", "B", 1))
	assert.GreaterOrEqual(t, resp.StatusCode, http.StatusBadRequest, resp.BodyString())
	assert.NotContains(t, srv.Files(), "b.json")
}

func TestIntegrationSource_EditsNeedASourceThatAllowsThem(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "cannot-edit"

	srv, url, _ := startSourceWith(t, sourceserver.Options{Tier: sourceserver.TierCompare})
	srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("ne-a", "A", 1)})

	// Enabling edits on a source that does not allow them is reported on the repository, not silently ignored.
	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url, "write"), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForUnhealthyRepository(t, repoName)

	repo, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
	require.NoError(t, err)
	status, _ := repo.Object["status"].(map[string]any)

	health, _ := status["health"].(map[string]any)
	assert.Contains(t, health["message"], "the source does not allow edits")

	fieldErrors, _ := status["fieldErrors"].([]any)
	require.Len(t, fieldErrors, 1)
	assert.Equal(t, "spec.workflows", fieldErrors[0].(map[string]any)["field"], "the form can point at the field")
}
