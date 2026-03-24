package quota

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

var env = common.NewSharedEnv()

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.SetQuotaStatus(provisioning.QuotaStatus{})
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	cleanProvisioningDir(t, helper.ProvisioningPath)
	return helper
}

func cleanProvisioningDir(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		require.NoError(t, os.RemoveAll(filepath.Join(dir, entry.Name())),
			"failed to clean provisioning dir entry %s", entry.Name())
	}
}

// triggerReconciliation forces the controller to re-process a repo by touching
// its health.checked timestamp. Unlike helper.TriggerRepositoryReconciliation,
// this uses EventuallyWithT to tolerate prolonged optimistic-locking conflicts
// that occur when the controller is actively reconciling the same repo.
func triggerReconciliation(t *testing.T, helper *common.ProvisioningTestHelper, name string) {
	t.Helper()
	ctx := t.Context()
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		repo, err := helper.Repositories.Resource.Get(ctx, name, metav1.GetOptions{})
		if !assert.NoError(c, err) {
			return
		}
		health, ok := repo.Object["status"].(map[string]any)["health"].(map[string]any)
		if !assert.True(c, ok, "missing status.health on %s", name) {
			return
		}
		health["checked"] = time.Now().UnixMilli() - 1
		_, err = helper.Repositories.Resource.UpdateStatus(ctx, repo, metav1.UpdateOptions{})
		assert.NoError(c, err, "reconciliation trigger for %s", name)
	}, common.WaitTimeoutDefault, 200*time.Millisecond, "should trigger reconciliation for %s", name)
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}
