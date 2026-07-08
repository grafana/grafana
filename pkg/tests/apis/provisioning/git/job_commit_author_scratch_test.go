package git

import (
	"context"
	"fmt"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestIntegrationGit_ExportJob_CommitAuthorScratch(t *testing.T) {
	helper := sharedGitHelper(t)
	ctx := context.Background()

	const repoName = "export-commit-author"

	dash := helper.LoadYAMLOrJSONFile("../exportunifiedtorepository/dashboard-test-v1.yaml")
	_, err := helper.DashboardsV1.Resource.Create(ctx, dash, metav1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = helper.DashboardsV1.Resource.Delete(ctx, dash.GetName(), metav1.DeleteOptions{})
	})

	_, local := helper.CreateGitRepo(t, repoName, nil)

	helper.TriggerJobAndWaitForComplete(t, repoName, provisioning.JobSpec{
		Action:  provisioning.JobActionPush,
		Message: "Export dashboards via JobSpec",
		Push:    &provisioning.ExportJobOptions{},
	})

	admin := helper.Org1.Admin
	expected := fmt.Sprintf("%s <%s>", admin.Identity.GetName(), admin.Identity.GetEmail())
	require.Equal(t, expected, common.LatestCommitAuthor(t, local, "main"))
}
