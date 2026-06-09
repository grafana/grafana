package jobs

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_ExportSpecificResources_FolderSkipped verifies the
// generalized selective-export controller against a non-dashboard kind end to
// end: a Folder reference in Push.Resources passes admission (the default
// supported set is {Folder, Dashboard}) and is then skipped by the worker
// (folders are exported as a tree by ExportFolders, not as standalone files)
// rather than failing the job with the old dashboard-only "is not a Dashboard"
// rejection. The job still succeeds and the requested dashboard is exported.
func TestIntegrationProvisioning_ExportSpecificResources_FolderSkipped(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(ctx, dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	const repo = "selective-export-folderskip-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		Copies:                 map[string]string{},
		SkipResourceAssertions: true,
	})

	// The folder reference need not resolve to an existing object: the
	// controller skips folders right after resolving the kind, before any Get.
	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: "test-v1", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				{Name: "any-folder", Kind: "Folder", Group: "folder.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	// The dashboard sibling is still exported despite the folder ref being skipped.
	present := filepath.Join(helper.ProvisioningPath, "test-dashboard-created-at-v1.json")
	_, err = os.Stat(present)
	require.NoError(t, err, "requested dashboard should be exported alongside the skipped folder ref")
}
