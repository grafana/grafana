package quota

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	apis "github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

const repositoryQuotaStalenessMetricName = "grafana_provisioning_repository_quota_staleness_seconds"

func TestIntegrationProvisioning_RepositoryUsesStaleQuotaWhenRefreshFails(t *testing.T) {
	helper := sharedHelper(t)
	initialQuota := provisioning.QuotaStatus{
		MaxRepositories:           5,
		MaxResourcesPerRepository: 100,
	}
	helper.SetQuotaStatus(initialQuota)

	const repoName = "stale-quota-repo"
	helper.CreateLocalRepo(t, common.TestRepo{
		Name:       repoName,
		SyncTarget: "folder",
		SkipSync:   true,
	})

	baselineCount, _ := quotaStalenessHistogram(t, helper)
	lookupErr := apierrors.NewInternalError(errors.New("quota service returned 500"))
	helper.SetQuotaError(lookupErr)

	staleHealthChecked := time.Now().Add(-10 * time.Minute).UnixMilli()
	patchRepositoryStatus(t, helper, repoName, map[string]any{
		"health": map[string]any{"checked": staleHealthChecked},
	})

	var staleSince int64
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, initialQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
		assert.Equal(collect, initialQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
		assert.Greater(collect, repo.Status.Health.Checked, staleHealthChecked)
		assert.Equal(collect, repo.Generation, repo.Status.ObservedGeneration)
		if assert.NotZero(collect, repo.Status.Quota.StaleSince) {
			staleSince = repo.Status.Quota.StaleSince
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	var firstCount uint64
	var firstSum float64
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		count, sum := quotaStalenessHistogram(t, helper)
		if assert.Greater(collect, count, baselineCount) {
			firstCount = count
			firstSum = sum
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	time.Sleep(time.Second)
	helper.TriggerRepositoryReconciliation(t, repoName)
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		count, sum := quotaStalenessHistogram(t, helper)
		assert.Greater(collect, count, firstCount)
		assert.Greater(collect, sum, firstSum)
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	refreshedQuota := provisioning.QuotaStatus{
		MaxRepositories:           8,
		MaxResourcesPerRepository: 200,
	}
	helper.SetQuotaStatus(refreshedQuota)
	helper.SetQuotaError(nil)
	helper.TriggerRepositoryReconciliation(t, repoName)

	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		obj, err := helper.Repositories.Resource.Get(t.Context(), repoName, metav1.GetOptions{})
		if !assert.NoError(collect, err) {
			return
		}
		repo := common.MustFromUnstructured[provisioning.Repository](t, obj)
		assert.Equal(collect, refreshedQuota.MaxRepositories, repo.Status.Quota.MaxRepositories)
		assert.Equal(collect, refreshedQuota.MaxResourcesPerRepository, repo.Status.Quota.MaxResourcesPerRepository)
		assert.Zero(collect, repo.Status.Quota.StaleSince)

		quota, found, nestedErr := nestedField(obj.Object, "status", "quota")
		if !assert.NoError(collect, nestedErr) || !assert.True(collect, found) {
			return
		}
		quotaMap, ok := quota.(map[string]interface{})
		if assert.True(collect, ok) {
			_, found = quotaMap["staleSince"]
			assert.False(collect, found, "staleSince should be removed after quota refresh recovers")
		}
	}, common.WaitTimeoutDefault, common.WaitIntervalDefault)

	assert.NotZero(t, staleSince)
}

func patchRepositoryStatus(t *testing.T, helper *common.ProvisioningTestHelper, repoName string, status map[string]any) {
	t.Helper()
	patch, err := json.Marshal(map[string]any{"status": status})
	require.NoError(t, err)
	_, err = helper.Repositories.Resource.Patch(
		t.Context(), repoName, types.MergePatchType, patch, metav1.PatchOptions{}, "status",
	)
	require.NoError(t, err)
}

func quotaStalenessHistogram(t *testing.T, helper *common.ProvisioningTestHelper) (uint64, float64) {
	t.Helper()
	rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Path:   "/metrics",
		Accept: "text/plain",
	}, &struct{}{})
	require.NotNil(t, rsp.Response)
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)

	parser := expfmt.NewTextParser(model.UTF8Validation)
	families, err := parser.TextToMetricFamilies(bytes.NewReader(rsp.Body))
	require.NoError(t, err)
	family := families[repositoryQuotaStalenessMetricName]
	require.NotNil(t, family)
	return histogramValues(t, family)
}

func histogramValues(t *testing.T, family *dto.MetricFamily) (uint64, float64) {
	t.Helper()
	require.Len(t, family.GetMetric(), 1)
	histogram := family.GetMetric()[0].GetHistogram()
	require.NotNil(t, histogram)
	return histogram.GetSampleCount(), histogram.GetSampleSum()
}
