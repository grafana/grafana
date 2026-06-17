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

// TestIntegrationProvisioning_ExportSpecificResources_FolderExported verifies the
// generalized selective-export controller against a non-dashboard kind end to
// end: a Folder reference in Push.Resources passes admission (the default
// supported set is {Folder, Dashboard}) and is exported as part of the folder
// tree (with its ancestry) rather than failing the job with the old
// dashboard-only "is not a Dashboard" rejection. The job succeeds and both the
// requested dashboard and the requested folder are written.
func TestIntegrationProvisioning_ExportSpecificResources_FolderExported(t *testing.T) {
	helper := sharedHelper(t)
	ctx := context.Background()

	dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(ctx, dash, metav1.CreateOptions{})
	require.NoError(t, err, "should be able to create v1 dashboard")

	// A real folder, named explicitly in the export. Unlike the old behavior, a
	// passed folder is now exported rather than silently skipped.
	folderUID := helper.CreateUnmanagedFolder(t, ctx, "exportedfolderref", "")

	const repo = "selective-export-folderref-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:                   repo,
		SyncTarget:             "instance",
		Workflows:              []string{"write"},
		Copies:                 map[string]string{},
		SkipResourceAssertions: true,
	})

	spec := provisioning.JobSpec{
		Action: provisioning.JobActionPush,
		Push: &provisioning.ExportJobOptions{
			Resources: []provisioning.ResourceRef{
				{Name: "test-v1", Kind: "Dashboard", Group: "dashboard.grafana.app"},
				{Name: folderUID, Kind: "Folder", Group: "folder.grafana.app"},
			},
		},
	}
	helper.TriggerJobAndWaitForSuccess(t, repo, spec)

	// The dashboard sibling is exported alongside the folder ref.
	present := filepath.Join(helper.ProvisioningPath, "test-dashboard-created-at-v1.json")
	_, err = os.Stat(present)
	require.NoError(t, err, "requested dashboard should be exported alongside the folder ref")

	// The explicitly named folder is exported as a directory in the repository.
	require.DirExists(t, filepath.Join(helper.ProvisioningPath, "exportedfolderref"),
		"explicitly requested folder should be exported")
}
