package source

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func allow(group, kind string) []any {
	return []any{map[string]any{"group": group, "kind": kind}}
}

func TestIntegrationSource_OnlyAllowedKindsAreWritten(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "allowed-kinds"

	srv, url, _ := startSource(t, sourceserver.TierCompare)
	srv.Publish(map[string][]byte{"a.json": common.DashboardJSON("allow-a", "A", 1)})

	obj := editRepo(sourceRepo(repoName, url), func(spec, _ map[string]any) {
		// Dashboards are not on the list, whatever the source serves.
		spec["source"].(map[string]any)["allow"] = allow("playlist.grafana.app", "Playlist")
	})
	_, err := helper.Repositories.Resource.Create(t.Context(), obj, metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)

	job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action: provisioning.JobActionPull,
		Pull:   &provisioning.SyncJobOptions{},
	})
	assert.NotEqual(t, "success", common.MustNestedString(job.Object, "status", "state"), "a refused file is reported, not silently dropped")
	assert.Contains(t, job.Object["status"], "warnings")
	helper.RequireRepoDashboardCount(t, repoName, 0)

	t.Run("allowing the kind lets it through", func(t *testing.T) {
		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(t, err)
		editRepo(current, func(spec, _ map[string]any) {
			spec["source"].(map[string]any)["allow"] = allow("dashboard.grafana.app", "*")
		})
		updateRepo(t, helper, current)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		helper.RequireRepoDashboardCount(t, repoName, 1)
	})
}

func TestIntegrationSource_ClaimsCannotOverlap(t *testing.T) {
	helper := sharedHelper(t)

	_, url, _ := startSource(t, sourceserver.TierTree)
	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo("first", url), metav1.CreateOptions{})
	require.NoError(t, err)

	t.Run("a second source claiming dashboards is refused", func(t *testing.T) {
		_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo("second", url), metav1.CreateOptions{})
		require.Error(t, err)
		assert.True(t, apierrors.IsInvalid(err), "got %v", err)
		assert.ErrorContains(t, err, "already claims")
	})

	t.Run("a source claiming other kinds is fine", func(t *testing.T) {
		other := editRepo(sourceRepo("third", url), func(spec, _ map[string]any) {
			spec["source"].(map[string]any)["allow"] = allow("plugins.grafana.app", "Plugin")
		})
		_, err := helper.Repositories.Resource.Create(t.Context(), other, metav1.CreateOptions{})
		assert.NoError(t, err)
	})
}

func TestIntegrationSource_EmptyTreeDoesNotPruneEverything(t *testing.T) {
	helper := sharedHelper(t)
	const repoName = "empty-tree"

	srv, url, _ := startSource(t, sourceserver.TierCompare)
	srv.Publish(map[string][]byte{
		"a.json": common.DashboardJSON("empty-a", "A", 1),
		"b.json": common.DashboardJSON("empty-b", "B", 1),
	})

	_, err := helper.Repositories.Resource.Create(t.Context(), sourceRepo(repoName, url), metav1.CreateOptions{})
	require.NoError(t, err)
	helper.WaitForHealthyRepository(t, repoName)
	common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
	helper.RequireRepoDashboardCount(t, repoName, 2)
	requireManaging(t, helper, repoName)

	srv.Publish(nil)

	for name, options := range map[string]*provisioning.SyncJobOptions{
		"incremental": {Incremental: true},
		"full":        {},
	} {
		t.Run("a faulty source cannot empty a repository: "+name, func(t *testing.T) {
			job := helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{Action: provisioning.JobActionPull, Pull: options})
			assert.Equal(t, string(provisioning.JobStateError), common.MustNestedString(job.Object, "status", "state"))
			helper.RequireRepoDashboardCount(t, repoName, 2)
		})
	}

	t.Run("an empty tree on purpose deletes everything", func(t *testing.T) {
		current, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		require.NoError(t, err)
		editRepo(current, func(spec, _ map[string]any) {
			spec["source"].(map[string]any)["emptyTreePolicy"] = "allow"
		})
		updateRepo(t, helper, current)

		common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
		helper.RequireRepoDashboardCount(t, repoName, 0)
	})
}
