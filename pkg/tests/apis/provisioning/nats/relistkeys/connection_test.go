package relistkeys

import (
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	ghmock "github.com/migueleliasweb/go-github-mock/src/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/provisioning/common"
)

// env is the sibling relist package's setup with [provisioning] keys_only_relist
// turned on: embedded NATS, the SQL KV backend off so nothing publishes watch
// notifications, and a short resync. The re-list is therefore the only reconcile
// driver, and it asks storage for keys rather than whole objects. Its own package
// because the setting is server-wide, which leaves the relist package covering
// the full-object path and this one covering the projection.
var env = common.NewSharedEnv(common.WithNATSReListOnly(2*time.Second), common.WithKeysOnlyReList())

func sharedHelper(t *testing.T) *common.ProvisioningTestHelper {
	t.Helper()
	helper := env.GetCleanHelper(t)
	helper.GetEnv().GithubRepoFactory.Client = ghmock.NewMockedHTTPClient()
	return helper
}

func TestMain(m *testing.M) {
	env.RunTestMain(m)
}

// scrapeMetric returns the value of one labelled counter from the server's own
// /metrics, which is how the rollout is read in a deployment too.
func scrapeMetric(t *testing.T, helper *common.ProvisioningTestHelper, sample string) float64 {
	t.Helper()
	rsp := apis.DoRequest(helper.K8sTestHelper, apis.RequestParams{
		Method: http.MethodGet, Path: "/metrics", User: helper.Org1.Admin,
	}, &metav1.Status{})
	require.Equal(t, http.StatusOK, rsp.Response.StatusCode)

	for line := range strings.Lines(string(rsp.Body)) {
		name, value, found := strings.Cut(strings.TrimSpace(line), " ")
		if !found || name != sample {
			continue
		}
		v, err := strconv.ParseFloat(value, 64)
		require.NoError(t, err)
		return v
	}
	return 0
}

// Nothing publishes watch notifications here, so a created Connection can only
// reach the controller through the periodic re-list, and with the setting on that
// re-list carries keys rather than bodies. Reaching healthy proves the controller
// reconciles from identities alone, re-fetching what it needs; the counter proves
// it was the projection that served it, which reconciling alone would not -- a
// server quietly returning bodies would look exactly the same.
func TestIntegrationProvisioningKeysReList_ConnectionReconciledFromKeys(t *testing.T) {
	helper := sharedHelper(t)

	created := helper.CreateNamedGithubConnection(t, "keys-relist-connection")
	helper.WaitForHealthyConnection(t, created.GetName())

	const (
		keys    = `grafana_provisioning_informer_relist_projection_total{group="provisioning.grafana.app",projection="keys",resource="connections"}`
		objects = `grafana_provisioning_informer_relist_projection_total{group="provisioning.grafana.app",projection="objects",resource="connections"}`
	)

	assert.Positive(t, scrapeMetric(t, helper, keys), "the re-list must have run on the keys projection")
	assert.Zero(t, scrapeMetric(t, helper, objects), "no tick may have fallen back to full objects")
}
