package provisioning

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationProvisioning_BlockManagerChange(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := common.RunGrafana(t)
	ctx := context.Background()

	const repo = "managed-change-test"
	helper.CreateRepo(t, common.TestRepo{
		Name:   repo,
		Target: "folder",
		Copies: map[string]string{
			"testdata/all-panels.json": "all-panels.json",
		},
		ExpectedDashboards: 1,
		ExpectedFolders:    1,
	})

	const dashboardUID = "n1jR8vnnz"
	var dashboard *unstructured.Unstructured
	var err error

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		dashboard, err = helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		if err != nil {
			collect.Errorf("dashboard not found yet: %s", err.Error())
			return
		}
		annotations := dashboard.GetAnnotations()
		assert.Equal(collect, string(utils.ManagerKindRepo), annotations[utils.AnnoKeyManagerKind])
		assert.Equal(collect, repo, annotations[utils.AnnoKeyManagerIdentity])
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault, "dashboard should be provisioned with repo manager")

	t.Run("changing manager from repo to kubectl is blocked", func(t *testing.T) {
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindKubectl)
		annotations[utils.AnnoKeyManagerIdentity] = "some-kubectl-manager"
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should not be able to change manager from repo to kubectl")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)

		unchanged, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, string(utils.ManagerKindRepo), unchanged.GetAnnotations()[utils.AnnoKeyManagerKind])
		require.Equal(t, repo, unchanged.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})

	t.Run("changing manager from repo to terraform is blocked", func(t *testing.T) {
		fresh, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)

		annotations := fresh.GetAnnotations()
		annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindTerraform)
		annotations[utils.AnnoKeyManagerIdentity] = "some-terraform-manager"
		fresh.SetAnnotations(annotations)

		_, err = helper.DashboardsV1.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.Error(t, err, "should not be able to change manager from repo to terraform")
		require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got: %v", err)

		unchanged, err := helper.DashboardsV1.Resource.Get(ctx, dashboardUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, string(utils.ManagerKindRepo), unchanged.GetAnnotations()[utils.AnnoKeyManagerKind])
		require.Equal(t, repo, unchanged.GetAnnotations()[utils.AnnoKeyManagerIdentity])
	})
}
