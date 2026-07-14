package git

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MigrateToBranch verifies migrating an instance to a
// non-default branch. In this mode the resources are exported to the target
// branch (a pull request workflow) and then removed from the instance — they are
// not taken over, because they cannot be synced back from a branch that has not
// been merged yet. They return as managed resources once the branch is merged and
// a regular sync runs on the configured branch.
func TestIntegrationProvisioning_MigrateToBranch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	// Two unmanaged dashboards created directly via the API.
	dash1 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	created1, err := helper.DashboardsV1.Resource.Create(ctx, dash1, metav1.CreateOptions{})
	require.NoError(t, err, "should create first unmanaged dashboard")
	dashName1 := created1.GetName()

	dash2 := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v2beta1.yaml")
	created2, err := helper.DashboardsV2beta1.Resource.Create(ctx, dash2, metav1.CreateOptions{})
	require.NoError(t, err, "should create second unmanaged dashboard")
	dashName2 := created2.GetName()

	// Instance-target git repo. The "branch" workflow is required to write to a
	// branch other than the configured (main) branch.
	const repo = "migrate-to-branch-repo"
	const branch = "feature-migrate"
	helper.CreateGitRepo(t, repo, nil, "write", "branch")

	// Migrate to the feature branch.
	helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
		Action: provisioning.JobActionMigrate,
		Migrate: &provisioning.MigrateJobOptions{
			Message: "Migrate unmanaged dashboards to a branch",
			Branch:  branch,
		},
	})

	// The migrated resources are removed from the instance.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		_, err := helper.DashboardsV1.Resource.Get(ctx, dashName1, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "dashboard 1 should be deleted after migrating to a branch, got err: %v", err)

		_, err = helper.DashboardsV1.Resource.Get(ctx, dashName2, metav1.GetOptions{})
		assert.True(collect, apierrors.IsNotFound(err), "dashboard 2 should be deleted after migrating to a branch, got err: %v", err)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "both dashboards should be deleted from the instance")

	// The exported files live on the target branch. Their paths derive from the
	// dashboard titles (see the selective-export test for the same mapping).
	exportedFiles := []string{
		"test-dashboard-created-at-v1.json",
		"test-dashboard-created-at-v2beta1.json",
	}
	for _, file := range exportedFiles {
		onBranch := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", file).
			Param("ref", branch).
			Do(ctx)
		require.NoError(t, onBranch.Error(), "exported file %q should exist on branch %q", file, branch)

		// It must not have been written to the configured (default) branch.
		onDefault := helper.AdminREST.Get().
			Namespace("default").
			Resource("repositories").
			Name(repo).
			SubResource("files", file).
			Do(ctx)
		require.Error(t, onDefault.Error(), "exported file %q must not exist on the default branch", file)
	}
}
