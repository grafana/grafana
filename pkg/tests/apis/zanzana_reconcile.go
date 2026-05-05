package apis

import (
	"bytes"
	"context"
	"net/http"
	"testing"
	"time"

	dto "github.com/prometheus/client_model/go"
	"github.com/prometheus/common/expfmt"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	zanzanaReconcileLastSuccessMetric = "grafana_zanzana_reconcile_last_success_timestamp_seconds"
	zanzanaMTReconcileDurationMetric  = "iam_authz_zanzana_reconciler_namespace_reconcile_duration_seconds"
	zanzanaMTReconcileSuccessLabel    = "success"
)

// ZanzanaMTReconcilerFeatureToggles bundles the IAM API feature flags required
// to run integration tests under the MT reconciler path. The MT reconciler reads
// IAM/folder CRDs from Unistore; these toggles enable real OSS implementations
// (users, teams, service accounts, in-memory GlobalRoles, legacy resource
// permissions) and route legacy HTTP writes into k8s via user/team redirects.
// Roles/RoleBindings are also enabled: OSS omits them from its reconciler CRD
// set so the flags are no-ops in OSS, but the enterprise reconciler CRD set
// adds them and needs the types registered in the scheme.
var ZanzanaMTReconcilerFeatureToggles = []string{
	featuremgmt.FlagZanzana,
	featuremgmt.FlagZanzanaNoLegacyClient,
	featuremgmt.FlagKubernetesAuthzZanzanaSync,
	featuremgmt.FlagKubernetesUsersApi,
	featuremgmt.FlagKubernetesUsersRedirect,
	featuremgmt.FlagKubernetesTeamsApi,
	featuremgmt.FlagKubernetesTeamsRedirect,
	featuremgmt.FlagKubernetesServiceAccountsApi,
	featuremgmt.FlagKubernetesAuthzGlobalRolesApi,
	featuremgmt.FlagKubernetesAuthzRolesApi,
	featuremgmt.FlagKubernetesAuthzRoleBindingsApi,
	featuremgmt.FlagKubernetesAuthzResourcePermissionApis,
}

// AwaitZanzanaReconcileNext waits for one Zanzana reconciliation cycle to
// complete after this call. The zanzana-sync hooks cover the CRUD fast path
// asynchronously, so assertions that depend on reconciled tuples need this
// barrier to avoid flakes.
//
// It is a no-op unless the `zanzana` feature toggle is enabled for the running test env.
func AwaitZanzanaReconcileNext(t *testing.T, helper *K8sTestHelper) {
	t.Helper()

	enabled := false
	if helper != nil {
		enabled = helper.GetEnv().FeatureToggles.GetEnabled(context.Background())[featuremgmt.FlagZanzana]
	}
	if helper == nil || !enabled {
		return
	}

	if mode := helper.GetEnv().Cfg.ZanzanaReconciler.Mode; mode == setting.ZanzanaReconcilerModeMT {
		awaitZanzanaMTReconcileNext(t, helper)
		return
	}

	baselineTimestamp, _ := getZanzanaReconcileLastSuccessTimestampSeconds(t, helper)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		ts, ok := getZanzanaReconcileLastSuccessTimestampSeconds(t, helper)
		assert.True(c, ok, "expected to find %s in /metrics", zanzanaReconcileLastSuccessMetric)
		if !ok {
			return
		}
		assert.Greater(c, ts, baselineTimestamp, "expected %s (%v) > baseline (%v)", zanzanaReconcileLastSuccessMetric, ts, baselineTimestamp)
	}, 30*time.Second, 250*time.Millisecond)
}

func awaitZanzanaMTReconcileNext(t *testing.T, helper *K8sTestHelper) {
	t.Helper()

	baseline := getZanzanaMTReconcileSuccessCount(t, helper)
	require.EventuallyWithT(t, func(c *assert.CollectT) {
		count := getZanzanaMTReconcileSuccessCount(t, helper)
		assert.Greater(c, count, baseline,
			"expected %s{status=%s} (%v) > baseline (%v)",
			zanzanaMTReconcileDurationMetric, zanzanaMTReconcileSuccessLabel, count, baseline)
	}, 30*time.Second, 250*time.Millisecond)
}

// fetchMetricFamilies scrapes the test server's /metrics endpoint and returns
// the parsed Prometheus metric families, or nil on transport/parse failure.
func fetchMetricFamilies(helper *K8sTestHelper) map[string]*dto.MetricFamily {
	rsp := DoRequest(helper, RequestParams{
		User:   helper.Org1.Admin,
		Path:   "/metrics",
		Accept: "text/plain",
	}, &struct{}{})
	if rsp.Response == nil || rsp.Response.StatusCode != http.StatusOK {
		return nil
	}

	parser := expfmt.NewTextParser(model.UTF8Validation)
	metrics, err := parser.TextToMetricFamilies(bytes.NewReader(rsp.Body))
	if err != nil {
		return nil
	}
	return metrics
}

func getZanzanaMTReconcileSuccessCount(t *testing.T, helper *K8sTestHelper) float64 {
	t.Helper()

	family := fetchMetricFamilies(helper)[zanzanaMTReconcileDurationMetric]
	if family == nil {
		return 0
	}

	var total float64
	for _, m := range family.Metric {
		for _, l := range m.GetLabel() {
			if l.GetName() == "status" && l.GetValue() == zanzanaMTReconcileSuccessLabel {
				if h := m.GetHistogram(); h != nil {
					total += float64(h.GetSampleCount())
				}
				break
			}
		}
	}
	return total
}

func getZanzanaReconcileLastSuccessTimestampSeconds(t *testing.T, helper *K8sTestHelper) (float64, bool) {
	t.Helper()

	family := fetchMetricFamilies(helper)[zanzanaReconcileLastSuccessMetric]
	if family == nil || len(family.Metric) == 0 {
		return 0, false
	}

	m := family.Metric[0]
	switch family.GetType() {
	case dto.MetricType_GAUGE:
		if m.Gauge == nil {
			return 0, false
		}
		return m.Gauge.GetValue(), true
	case dto.MetricType_UNTYPED:
		if m.Untyped == nil {
			return 0, false
		}
		return m.Untyped.GetValue(), true
	default:
		return 0, false
	}
}
