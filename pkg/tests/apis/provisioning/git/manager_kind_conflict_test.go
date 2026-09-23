package git

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_GitSync_ManagerKindConflict covers full and incremental
// pulls containing a Terraform-managed dashboard with allowsEdits=true and a valid
// dashboard. It verifies that the conflicting dashboard stays unchanged, the valid
// dashboard syncs, and manager-kind warnings advance lastRef. When quota blocks the
// conflicting file before a write, the quota warning instead preserves lastRef.
func TestIntegrationProvisioning_GitSync_ManagerKindConflict(t *testing.T) {
	for _, tt := range []struct {
		syncType     string
		order        string
		conflictPath string
		validPath    string
		quotaLimit   int64
		quotaBlocked bool
	}{
		{"full", "conflict-first", "a-conflicting.json", "b-valid.json", 3, false},
		{"full", "valid-first", "b-conflicting.json", "a-valid.json", 3, false},
		{"incremental", "conflict-first", "a-conflicting.json", "b-valid.json", 2, false},
		{"incremental", "valid-first", "b-conflicting.json", "a-valid.json", 2, true},
	} {
		t.Run(tt.syncType+"/"+tt.order, func(t *testing.T) {
			helper := sharedGitHelper(t)
			helper.SetQuotaStatus(provisioning.QuotaStatus{MaxResourcesPerRepository: tt.quotaLimit})
			t.Cleanup(func() { helper.SetQuotaStatus(provisioning.QuotaStatus{}) })
			repoName := "git-manager-kind-" + tt.syncType + "-" + tt.order
			_, local := helper.CreateGitRepo(t, repoName, map[string][]byte{
				"initial.json": common.DashboardJSON("initial", "Initial Dashboard", 1),
			})
			common.SyncAndWait(t, helper, common.Repo(repoName), common.Succeeded())
			helper.WaitForResourceQuotaLimit(t, repoName, tt.quotaLimit)
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

			require.NoError(t, local.CreateFile(tt.conflictPath, string(common.DashboardJSON("conflicting", "Git Dashboard", 1))))
			require.NoError(t, local.CreateFile(tt.validPath, string(common.DashboardJSON("valid", "Valid Dashboard", 1))))
			gitCommitPush(t, local, "add conflicting and valid dashboards")
			ref, err := local.Git("rev-parse", "HEAD")
			require.NoError(t, err)
			currentRef := strings.TrimSpace(ref)
			require.NotEqual(t, previousRef, currentRef)

			conflict := utils.NewForbiddenManagerKindChangeError(currentManager,
				utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: repoName})
			warning, expectedRef := conflict.Error(), currentRef
			if tt.quotaBlocked {
				warning = "resource quota exceeded, skipping creation of " + tt.conflictPath
				expectedRef = previousRef
			}
			opts := []common.SyncOption{
				common.Repo(repoName), common.Warning(), common.Expect(hasWarningContaining(warning)),
			}
			if tt.syncType == "incremental" {
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
				assert.Equal(c, expectedRef, common.MustNestedString(repo.Object, "status", "sync", "lastRef"))
				assert.Equal(c, "warning", common.MustNestedString(repo.Object, "status", "sync", "state"))
				messages := common.MustNestedStringSlice(repo.Object, "status", "sync", "message")
				require.Len(c, messages, 1)
				assert.Contains(c, messages[0], warning)
				assert.Contains(c, messages[0], "file: "+tt.conflictPath)
				if !tt.quotaBlocked {
					assert.Contains(c, messages[0], "name: conflicting")
				}
			}, common.WaitTimeoutDefault, common.WaitIntervalDefault)
		})
	}
}
