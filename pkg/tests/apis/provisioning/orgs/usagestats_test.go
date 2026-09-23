package orgs

import (
	"encoding/base64"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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

// TestIntegrationProvisioning_MultiOrgConnectionUsageStats verifies that the
// provisioning usage-stats collector aggregates connection counts across every
// org's namespace, mirroring the repository coverage above.
//
// It creates one GitHub connection in two different organizations, waits for the
// controller to reconcile both to healthy, and asserts the anonymous usage
// report reflects the connection type, health, and Ready-reason breakdowns.
func TestIntegrationProvisioning_MultiOrgConnectionUsageStats(t *testing.T) {
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

	// One GitHub connection in each org. The shared GithubConnectionFactory mock
	// (wired by CreateGithubConnection) lets both reconcile to healthy.
	_, err := orgAHelper.CreateGithubConnection(t, githubConnection("org-a-usage-conn", defaultNS))
	require.NoError(t, err, "create org A connection")
	_, err = orgBHelper.CreateGithubConnection(t, githubConnection("org-b-usage-conn", orgBNS))
	require.NoError(t, err, "create org B connection")

	orgAHelper.WaitForHealthyConnection(t, "org-a-usage-conn")
	orgBHelper.WaitForHealthyConnection(t, "org-b-usage-conn")

	assert.EventuallyWithT(t, func(collect *assert.CollectT) {
		report := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
			Method: http.MethodGet,
			Path:   "/api/admin/usage-report-preview",
			User:   helper.Org1.Admin,
		}, &usagestats.Report{})

		m := report.Result.Metrics

		// One GitHub connection per org => 2 total, aggregated across namespaces.
		assert.Equal(collect, 2.0, m["stats.connection.count"], "connections summed across orgs")
		assert.Equal(collect, 2.0, m["stats.connection."+string(provisioning.GithubConnectionType)+".count"], "github connections summed across orgs")
		assert.Equal(collect, 2.0, m["stats.connection.healthy.count"], "healthy connections summed across orgs")
		assert.Equal(collect, 2.0, m["stats.connection.ready_reason.available.count"], "available connections summed across orgs")
	}, time.Second*30, time.Millisecond*250, "expected multi-org provisioning connection usage stats")
}

// githubConnection builds a minimal GitHub App connection with the private key
// needed for the controller (via the mocked client) to reconcile it healthy.
func githubConnection(name, namespace string) *unstructured.Unstructured {
	privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(common.TestGithubPrivateKeyPEM))
	return &unstructured.Unstructured{Object: map[string]any{
		"apiVersion": "provisioning.grafana.app/v0alpha1",
		"kind":       "Connection",
		"metadata": map[string]any{
			"name":      name,
			"namespace": namespace,
		},
		"spec": map[string]any{
			"title": name,
			"type":  string(provisioning.GithubConnectionType),
			"github": map[string]any{
				"appID":          "123456",
				"installationID": "454545",
			},
		},
		"secure": map[string]any{
			"privateKey": map[string]any{
				"create": privateKeyBase64,
			},
		},
	}}
}
