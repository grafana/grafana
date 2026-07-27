package orgs

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// TestIntegrationProvisioning_MultiOrgUsageStats verifies that the provisioning
// usage-stats collector enumerates every org's namespace (not just "default")
// and aggregates repository and managed-object counts across all of them.
//
// It creates one synced local repository (with a dashboard) in two different
// organizations and asserts that the anonymous usage report
// (/api/admin/usage-report-preview) reflects both orgs.
func TestIntegrationProvisioning_MultiOrgUsageStats(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := sharedHelper(t)

	defaultNS := helper.Namespacer(helper.Org1.OrgID) // "default"
	orgBNS := helper.Namespacer(helper.OrgB.OrgID)    // "org-<id>"

	orgAHelper := helper.WithNamespace(t, defaultNS, helper.Org1.Admin)
	orgBHelper := helper.WithNamespace(t, orgBNS, helper.OrgB.Admin)
	defer orgAHelper.Cleanup(t)
	defer orgBHelper.Cleanup(t)

	// One synced local repo (with a single dashboard) in each org. Distinct
	// LocalPath dirs keep the two repositories fully isolated on disk.
	orgAHelper.CreateLocalRepo(t, common.TestRepo{
		Name:      "org-a-usage-repo",
		LocalPath: helper.ProvisioningPath + "/org-a-usage-repo",
		Copies:    map[string]string{"../testdata/all-panels.json": "dashboard.json"},
	})
	orgBHelper.CreateLocalRepo(t, common.TestRepo{
		Name:      "org-b-usage-repo",
		LocalPath: helper.ProvisioningPath + "/org-b-usage-repo",
		Copies:    map[string]string{"../testdata/all-panels.json": "dashboard.json"},
	})

	assert.EventuallyWithT(t, func(collect *assert.CollectT) {
		report := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
			Method: http.MethodGet,
			Path:   "/api/admin/usage-report-preview",
			User:   helper.Org1.Admin,
		}, &usagestats.Report{})

		m := report.Result.Metrics

		// Aggregated across both orgs: one local repo each => 2 total. Before the
		// multi-org fix only the "default" namespace was counted, so this was 1.
		assert.Equal(collect, 2.0, m["stats.repository.local.count"], "repos summed across orgs")

		// Managed objects are counted across orgs too (>= the 2 synced dashboards).
		managed, _ := m["stats.managed_by.repo.count"].(float64)
		assert.GreaterOrEqual(collect, managed, 2.0, "repo-managed objects summed across orgs")
	}, time.Second*30, time.Millisecond*250, "expected multi-org provisioning usage stats")
}
