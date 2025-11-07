package compat

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	prom_model "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationConvertPrometheusAlertRuleRetrieval verifies that an alert rule created
// through the Prometheus (mimirtool compatible) conversion API can be retrieved via the
// new Kubernetes rules API and retains expected fields (title, expressions, interval,
// folder annotation, group labels, and provenance converted_prometheus).
func TestIntegrationConvertPrometheusAlertRuleRetrieval(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	// K8s client for new rules API
	k8sAlertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)

	// Legacy + conversion API client
	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	// Ensure legacy API is enabled (sanity)
	allRules, status, _ := legacyClient.GetAllRulesWithStatus(t)
	require.Equal(t, 200, status)
	require.NotNil(t, allRules)

	// Create folder that will act as namespace title
	folderUID := "test-folder-convert"
	common.CreateTestFolder(t, helper, folderUID)

	// Build a Prometheus-compatible rule group payload (minimal) for conversion API
	// We simulate a simple alert rule with expr and for duration; conversion API will set provenance.
	// We pick static values; Grafana rule title will mirror Prometheus 'alert' name.
	forDuration := prom_model.Duration(10 * time.Second)
	interval20, err := prom_model.ParseDuration("20s")
	require.NoError(t, err)
	promGroup := apimodels.PrometheusRuleGroup{
		Name:     "test-group",
		Interval: interval20,
		Rules: []apimodels.PrometheusRule{
			{
				Alert: "ConvertedAlertTest",
				Expr:  "vector(1)", // simple always firing expression
				For:   &forDuration,
				Labels: map[string]string{
					"severity": "critical",
				},
				Annotations: map[string]string{
					"summary": "Converted alert rule test",
				},
			},
		},
	}

	// Create a real Prometheus datasource; conversion API requires a Prometheus-compatible datasource (cannot use __expr__).
	ds := legacyClient.CreateDatasource(t, "prometheus")
	dsUID := ds.Body.Datasource.UID
	require.NotEmpty(t, dsUID, "prometheus datasource UID must not be empty")
	defer legacyClient.DeleteDatasource(t, dsUID)
	headers := map[string]string{}

	// Post conversion (client signature: namespaceTitle, datasourceUID, promGroup, headers)
	// Use the folder title as the namespace title for conversion API lookup.
	// Our helper created a folder with title "Test Folder" and UID folderUID.
	resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, promGroup, headers)
	require.Equal(t, "success", resp.Status)

	// Retrieve the converted rule via new K8s API immediately after the API call.
	ruleList, err := k8sAlertClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	var found *v0alpha1.AlertRule
	for _, item := range ruleList.Items {
		if item.Spec.Title == "ConvertedAlertTest" { // Title should match the Prometheus alert name
			copy := item.DeepCopy()
			found = copy
			break
		}
	}
	require.NotNil(t, found, "expected to find converted alert rule via K8s API")

	// Assertions on converted rule fields
	require.Equal(t, folderUID, found.Annotations["grafana.app/folder"], "folder annotation must match folder UID")
	require.Equal(t, "test-group", found.Labels[v0alpha1.GroupLabelKey], "group label must match group name")
	require.NotEmpty(t, found.Labels[v0alpha1.GroupIndexLabelKey], "group index label must be populated")

	// Interval: parse prom group interval and compare with spec trigger interval
	require.Equal(t, promGroup.Interval.String(), string(found.Spec.Trigger.Interval), "interval mismatch")

	// Expression/model checks: Alert rule conversion produces query + math + threshold nodes.
	require.Equal(t, 3, len(found.Spec.Expressions), "expected three expressions (query, math, threshold) in converted alert rule")
	for ref, exp := range found.Spec.Expressions {
		require.NotNil(t, exp.Model, "expression model %s should not be nil", ref)
		// Only query expression carries a datasource UID; math/threshold may omit it. If present, must match dsUID.
		if exp.DatasourceUID != nil {
			require.EqualValues(t, dsUID, *exp.DatasourceUID)
		}
	}

	// Provenance should be converted_prometheus
	require.Equal(t, ngmodels.ProvenanceConvertedPrometheus, ngmodels.Provenance(found.GetProvenanceStatus()), "provenance mismatch")

	// Basic JSON model sanity (non-empty if map)
	// Basic JSON model sanity for at least one expression
	var sanityChecked bool
	for _, exp := range found.Spec.Expressions {
		if m, ok := exp.Model.(map[string]interface{}); ok {
			require.NotEmpty(t, m)
			sanityChecked = true
			break
		}
	}
	require.True(t, sanityChecked, "expected at least one expression model to be a non-empty map")
}

// TestIntegrationConvertPrometheusRecordingRuleRetrieval verifies recording rule conversion retrieval via K8s API.
func TestIntegrationConvertPrometheusRecordingRuleRetrieval(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)

	k8sRecordingClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)
	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	allRules, status, _ := legacyClient.GetAllRulesWithStatus(t)
	require.Equal(t, 200, status)
	require.NotNil(t, allRules)

	folderUID := "test-folder-convert-record"
	common.CreateTestFolder(t, helper, folderUID)

	forDuration := prom_model.Duration(5 * time.Second)
	interval20, err := prom_model.ParseDuration("20s")
	require.NoError(t, err)
	promGroup := apimodels.PrometheusRuleGroup{
		Name:     "test-group-rec",
		Interval: interval20,
		Rules: []apimodels.PrometheusRule{
			{
				Record:      "converted_metric_total",
				Expr:        "vector(2)",
				For:         &forDuration, // For is ignored for recording rules but included for consistency
				Labels:      map[string]string{"job": "demo"},
				Annotations: map[string]string{"summary": "Converted recording rule test"},
			},
		},
	}
	// Create a real Prometheus datasource for recording rule conversion.
	ds := legacyClient.CreateDatasource(t, "prometheus")
	dsUID := ds.Body.Datasource.UID
	require.NotEmpty(t, dsUID, "prometheus datasource UID must not be empty")
	defer legacyClient.DeleteDatasource(t, dsUID)
	headers := map[string]string{
		"X-Grafana-Alerting-Target-Datasource-UID": dsUID,
	}

	resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, promGroup, headers)
	require.Equal(t, "success", resp.Status)

	// Retrieve the converted recording rule immediately
	list, err := k8sRecordingClient.List(ctx, v1.ListOptions{})
	require.NoError(t, err)
	var found *v0alpha1.RecordingRule
	for _, item := range list.Items {
		if item.Spec.Metric == "converted_metric_total" {
			copy := item.DeepCopy()
			found = copy
			break
		}
	}
	require.NotNil(t, found, "expected to find converted recording rule via K8s API")

	require.Equal(t, folderUID, found.Annotations["grafana.app/folder"], "folder annotation must match")
	require.Equal(t, "test-group-rec", found.Labels[v0alpha1.GroupLabelKey])
	require.NotEmpty(t, found.Labels[v0alpha1.GroupIndexLabelKey])

	require.Equal(t, promGroup.Interval.String(), string(found.Spec.Trigger.Interval))

	// Verify expressions map non-empty
	require.Equal(t, 1, len(found.Spec.Expressions))
	var exprSpec v0alpha1.RecordingRuleExpression
	for _, v := range found.Spec.Expressions {
		exprSpec = v
		break
	}
	require.NotNil(t, exprSpec.Model)

	// Datasource should match provided header
	require.EqualValues(t, dsUID, *exprSpec.DatasourceUID)

	require.Equal(t, ngmodels.ProvenanceConvertedPrometheus, ngmodels.Provenance(found.GetProvenanceStatus()))

	if m, ok := exprSpec.Model.(map[string]interface{}); ok {
		require.NotEmpty(t, m)
	} else if b, ok := exprSpec.Model.([]byte); ok {
		tmp := map[string]interface{}{}
		_ = json.Unmarshal(b, &tmp)
		require.NotEmpty(t, tmp)
	}
}
