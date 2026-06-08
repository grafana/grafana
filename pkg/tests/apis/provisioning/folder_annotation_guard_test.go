package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

// TestIntegrationProvisioning_FolderAnnotationGuardByConfig verifies that whether a
// synced resource receives a grafana.app/folder annotation is purely a function of the
// [provisioning] resources configuration: a kind declared WITH the folder capability
// ("...:folder") is folder-contained and gets the annotation, while the same kind
// declared WITHOUT it is treated as org-scoped and must not have a (meaningless,
// possibly dangling) folder annotation stamped onto it.
//
// Dashboards are used as the subject because they are actually served and discoverable
// in the integration apiserver; the org-scoped vs folder-contained decision is driven
// entirely by the capability token, exactly as it would be for a new resource type.
func TestIntegrationProvisioning_FolderAnnotationGuardByConfig(t *testing.T) {
	const sourcePath = "team-a/dashboard.json"

	t.Run("folder-scoped kind gets a folder annotation", func(t *testing.T) {
		helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
			// Dashboards declared WITH the folder capability: folder-contained.
			opts.ProvisioningResources = []string{
				"folder.grafana.app/Folder:folder",
				"dashboard.grafana.app/Dashboard:folder",
			}
		})
		ctx := context.Background()

		const repo = "folder-guard-scoped"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "folder",
			Copies: map[string]string{
				"testdata/all-panels.json": sourcePath,
			},
			SkipResourceAssertions: true,
		})

		requireRepoDashboardFolder(t, helper, ctx, repo, sourcePath, func(c *assert.CollectT, folder string) {
			assert.NotEmpty(c, folder, "a folder-scoped dashboard must carry a folder annotation")
		})
	})

	t.Run("org-scoped kind gets no folder annotation", func(t *testing.T) {
		helper := common.RunGrafana(t, func(opts *testinfra.GrafanaOpts) {
			// Same dashboard kind, but declared WITHOUT the folder capability: org-scoped.
			// Folders keep the capability so the folder sync target still functions.
			opts.ProvisioningResources = []string{
				"folder.grafana.app/Folder:folder",
				"dashboard.grafana.app/Dashboard",
			}
		})
		ctx := context.Background()

		const repo = "folder-guard-org-scoped"
		helper.CreateLocalRepo(t, common.TestRepo{
			Name:       repo,
			SyncTarget: "instance",
			Copies: map[string]string{
				"testdata/all-panels.json": sourcePath,
			},
			SkipResourceAssertions: true,
		})

		// Empty expected folder UID asserts the dashboard carries no folder annotation.
		common.RequireRepoDashboardParent(t, helper.DashboardsV1, ctx, repo, sourcePath, "")
	})
}

// requireRepoDashboardFolder finds the dashboard managed by repoName at sourcePath and
// runs check against its grafana.app/folder annotation value.
func requireRepoDashboardFolder(t *testing.T, helper *common.ProvisioningTestHelper, ctx context.Context, repoName, sourcePath string, check func(c *assert.CollectT, folder string)) {
	t.Helper()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		list, err := helper.DashboardsV1.Resource.List(ctx, metav1.ListOptions{})
		if !assert.NoError(c, err, "failed to list dashboards") {
			return
		}
		for _, d := range list.Items {
			annotations := d.GetAnnotations()
			if annotations["grafana.app/managerId"] != repoName || annotations["grafana.app/sourcePath"] != sourcePath {
				continue
			}
			folder, _, _ := unstructured.NestedString(d.Object, "metadata", "annotations", "grafana.app/folder")
			check(c, folder)
			return
		}
		c.Errorf("dashboard with sourcePath %q not found for repo %q", sourcePath, repoName)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault,
		"expected dashboard %q to be synced for repo %q", sourcePath, repoName)
}
