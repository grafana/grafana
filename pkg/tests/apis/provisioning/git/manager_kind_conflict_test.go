package git

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

func TestIntegrationProvisioning_GitSync_ManagerKindConflict(t *testing.T) {
	for _, syncType := range []string{"full", "incremental"} {
		t.Run(syncType, func(t *testing.T) {
			helper := sharedGitHelper(t)
			repoName := "git-manager-kind-" + syncType
			_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
				"initial.json": common.DashboardJSON("initial", "Initial Dashboard", 1),
			})
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
			repoBefore, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
			require.NoError(t, err)
			previousRef := common.MustNestedString(repoBefore.Object, "status", "sync", "lastRef")

			currentManager := utils.ManagerProperties{
				Kind: utils.ManagerKindTerraform, Identity: "terraform-provider", AllowsEdits: true,
			}
			dashboard := common.NewUnmanagedDashboard(dashboardV1.DashboardResourceInfo.GroupVersion().String(), "Terraform Dashboard", "")
			dashboard.SetGenerateName("")
			dashboard.SetName("conflicting")
			meta, err := utils.MetaAccessor(dashboard)
			require.NoError(t, err)
			// AllowsEdits passes provisioning's ownership check, but the API still rejects changing the manager kind.
			meta.SetManagerProperties(currentManager)
			_, err = helper.DashboardsV1.Resource.Create(t.Context(), dashboard, metav1.CreateOptions{})
			require.NoError(t, err)
			before, err := helper.DashboardsV1.Resource.Get(t.Context(), dashboard.GetName(), metav1.GetOptions{})
			require.NoError(t, err)

			require.NoError(t, local.CreateFile("conflicting.json", string(common.DashboardJSON("conflicting", "Git Dashboard", 1))))
			require.NoError(t, local.CreateFile("valid.json", string(common.DashboardJSON("valid", "Valid Dashboard", 1))))
			gitCommitPush(t, local, "add conflicting and valid dashboards")
			ref, err := local.Git("rev-parse", "HEAD")
			require.NoError(t, err)
			currentRef := strings.TrimSpace(ref)
			require.NotEqual(t, previousRef, currentRef)

			conflict := utils.NewResourceManagerKindConflictError(currentManager,
				utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repoName})
			opts := []common.SyncOption{
				common.Repo(repoName), common.Warning(), common.Expect(hasWarningContaining(conflict.Error())),
			}
			if syncType == "incremental" {
				opts = append(opts, common.Incremental)
			}
			common.SyncAndWait(t, helper, opts...)

			after, err := helper.DashboardsV1.Resource.Get(t.Context(), dashboard.GetName(), metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, before.GetResourceVersion(), after.GetResourceVersion())
			require.Equal(t, before.GetAnnotations(), after.GetAnnotations())
			require.Equal(t, before.Object["spec"], after.Object["spec"])
			common.RequireDashboardTitle(t, helper.DashboardsV1, "valid", "Valid Dashboard")
			helper.RequireRepoDashboardCount(t, repoName, 2)
			require.EventuallyWithT(t, func(c *assert.CollectT) {
				repo, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
				require.NoError(c, err)
				assert.Equal(c, currentRef, common.MustNestedString(repo.Object, "status", "sync", "lastRef"))
				assert.Equal(c, "warning", common.MustNestedString(repo.Object, "status", "sync", "state"))
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	}
}
