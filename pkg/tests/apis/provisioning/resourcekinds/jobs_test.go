package resourcekinds

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ResourceKinds_DeleteJob verifies that a bulk delete job removes
// the targeted files from the repository and deprovisions the resources from Grafana.
func TestIntegrationProvisioning_ResourceKinds_DeleteJob(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			repo := rk.name + "-delete-job-repo"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:                   repo,
				SyncTarget:             "instance",
				Workflows:              []string{"write"},
				SkipResourceAssertions: true,
			})

			const count = 2
			paths := make([]string, count)
			names := make([]string, count)
			for i := 0; i < count; i++ {
				name, title := rk.instance(i)
				paths[i] = fmt.Sprintf("del-%s.json", name)
				names[i] = name
				postResourceFile(t, ctx, helper, rk, repo, paths[i], name, title)
				_ = common.RequireResource(t, ctx, client.Resource, name)
				t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
			}

			// Bulk delete both files in a single job.
			helper.TriggerJobAndWaitForComplete(t, repo, provisioning.JobSpec{
				Action: provisioning.JobActionDelete,
				Delete: &provisioning.DeleteJobOptions{Paths: paths},
			})

			repoFiles := repositoryFilePaths(t, ctx, helper, repo)
			for i := range paths {
				require.NotContains(t, repoFiles, paths[i], "%s should be deleted from the repository", paths[i])
				require.EventuallyWithT(t, func(collect *assert.CollectT) {
					_, err := client.Resource.Get(ctx, names[i], metav1.GetOptions{})
					assert.True(collect, apierrors.IsNotFound(err), "%s should be deprovisioned, got: %v", names[i], err)
				}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s should be deleted by the delete job", names[i])
			}
		})
	}
}

// TestIntegrationProvisioning_ResourceKinds_MoveJob verifies that a bulk move job relocates the
// files within the repository, the resources remain in Grafana, and the post-move full sync
// refreshes each moved resource's source-path annotation (git-ui-sync-project#1199).
func TestIntegrationProvisioning_ResourceKinds_MoveJob(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	for _, rk := range resourceKinds {
		rk := rk
		t.Run(rk.name, func(t *testing.T) {
			client := rk.client(t, helper)

			repo := rk.name + "-move-job-repo"
			helper.CreateLocalRepo(t, common.TestRepo{
				Name:                   repo,
				SyncTarget:             "instance",
				Workflows:              []string{"write"},
				SkipResourceAssertions: true,
			})

			const count = 2
			paths := make([]string, count)
			names := make([]string, count)
			for i := 0; i < count; i++ {
				name, title := rk.instance(i)
				paths[i] = fmt.Sprintf("mv-%s.json", name)
				names[i] = name
				postResourceFile(t, ctx, helper, rk, repo, paths[i], name, title)
				_ = common.RequireResource(t, ctx, client.Resource, name)
				t.Cleanup(func() { _ = client.Resource.Delete(ctx, name, metav1.DeleteOptions{}) })
			}

			// Bulk move both files into a subdirectory in a single job. The move plus its
			// post-move re-upsert must complete cleanly.
			helper.TriggerJobAndWaitForSuccess(t, repo, provisioning.JobSpec{
				Action: provisioning.JobActionMove,
				Move:   &provisioning.MoveJobOptions{Paths: paths, TargetPath: "archived/"},
			})

			repoFiles := repositoryFilePaths(t, ctx, helper, repo)
			for i := range paths {
				movedPath := "archived/" + paths[i]
				require.NotContains(t, repoFiles, paths[i], "%s should no longer be at its original path", paths[i])
				require.Contains(t, repoFiles, movedPath, "%s should be moved under archived/", paths[i])
				require.EventuallyWithT(t, func(collect *assert.CollectT) {
					got, err := client.Resource.Get(ctx, names[i], metav1.GetOptions{})
					if !assert.NoError(collect, err) {
						return
					}
					assert.Equal(collect, movedPath, got.GetAnnotations()[utils.AnnoKeySourcePath],
						"%s source path should be refreshed to the moved location", names[i])
				}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "%s source path should be refreshed after the move job", names[i])
			}
		})
	}
}
