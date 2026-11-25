package compat

import (
	"context"
	"testing"
	"time"

	prom_model "github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/prom/groupwriter"
	"github.com/grafana/grafana/pkg/tests/api/alerting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationConvertPrometheusRuleSequence verifies that the conversion API writes its rules with
// their group through the rules API, keeps a rule sequence for each imported group with a recording
// rule, and that both follow re-imports and deletes.
func TestIntegrationConvertPrometheusRuleSequence(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{EnableRecordingRules: true})
	seqClient := common.NewRuleSequenceClient(t, helper.Org1.Admin)
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)
	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)
	legacyClient := alerting.NewAlertingLegacyAPIClient(helper.GetListenerAddress(), "admin", "admin")

	folderUID := "test-folder-sequence"
	common.CreateTestFolder(t, helper, folderUID)
	ds := legacyClient.CreateDatasource(t, "prometheus")
	dsUID := ds.Body.Datasource.UID

	// A group name doesn't have to be a valid label value.
	group := apimodels.PrometheusRuleGroup{
		Name:     "Node Exporter disks",
		Interval: prom_model.Duration(time.Minute),
		Rules: []apimodels.PrometheusRule{
			{Record: "recorded", Expr: "vector(1)"},
			{Alert: "UsesRecorded", Expr: "recorded > 0"},
		},
	}
	seqName := groupwriter.SequenceUID(helper.Org1.OrgID, folderUID, group.Name)

	resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, group, nil)
	require.Equal(t, "success", resp.Status)

	seq, err := seqClient.Get(ctx, seqName, v1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, folderUID, seq.Annotations[v1beta1.FolderAnnotationKey])
	require.Equal(t, v1beta1.ProvenanceStatusConvertedPrometheus, seq.GetProvenanceStatus())
	require.Len(t, seq.Spec.RecordingRules, 1)
	require.Len(t, seq.Spec.AlertingRules, 1)
	recordingUID := string(seq.Spec.RecordingRules[0].Name)

	recorded, err := recClient.Get(ctx, recordingUID, v1.GetOptions{})
	require.NoError(t, err)
	require.Equal(t, group.Name, recorded.Labels[v1beta1.GroupLabelKey])

	t.Run("an identical re-import writes nothing", func(t *testing.T) {
		resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, group, nil)
		require.Equal(t, "success", resp.Status)

		again, err := recClient.Get(ctx, recordingUID, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, recorded.ResourceVersion, again.ResourceVersion)
	})

	t.Run("a member cannot be deleted through the rules API", func(t *testing.T) {
		// The membership that admission checks is updated asynchronously after the import. A dry run
		// keeps an attempt made before the update from deleting the rule.
		require.Eventually(t, func() bool {
			return v1beta1.IsRuleSequenceMemberError(recClient.Delete(ctx, recordingUID, v1.DeleteOptions{DryRun: []string{v1.DryRunAll}}))
		}, 10*time.Second, 100*time.Millisecond)
	})

	t.Run("a re-import that drops a rule removes it from the sequence", func(t *testing.T) {
		withoutAlert := group
		withoutAlert.Rules = group.Rules[:1]
		resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, withoutAlert, nil)
		require.Equal(t, "success", resp.Status)

		seq, err := seqClient.Get(ctx, seqName, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, recordingUID, string(seq.Spec.RecordingRules[0].Name))
		require.Empty(t, seq.Spec.AlertingRules)
	})

	t.Run("a group without recording rules keeps its interval", func(t *testing.T) {
		alertsOnly := apimodels.PrometheusRuleGroup{
			Name:     "alerts-only",
			Interval: prom_model.Duration(5 * time.Minute),
			Rules:    []apimodels.PrometheusRule{{Alert: "Up", Expr: "up == 0"}},
		}
		resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, alertsOnly, nil)
		require.Equal(t, "success", resp.Status)

		rules := groupRules(t, alertClient, alertsOnly.Name)
		require.Len(t, rules, 1)
		require.Equal(t, "5m", string(rules[0].Spec.Trigger.Interval))
		_, err := seqClient.Get(ctx, groupwriter.SequenceUID(helper.Org1.OrgID, folderUID, alertsOnly.Name), v1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("a rule with an explicit UID moves between groups", func(t *testing.T) {
		pinned := apimodels.PrometheusRule{Alert: "Pinned", Expr: "up == 0", Labels: map[string]string{"__grafana_alert_rule_uid__": "pinned-rule"}}
		for _, name := range []string{"pinned-a", "pinned-b"} {
			resp := legacyClient.ConvertPrometheusPostRuleGroup(t, "Test Folder", dsUID, apimodels.PrometheusRuleGroup{Name: name, Rules: []apimodels.PrometheusRule{pinned}}, nil)
			require.Equal(t, "success", resp.Status)
		}

		moved, err := alertClient.Get(ctx, "pinned-rule", v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, "pinned-b", moved.Labels[v1beta1.GroupLabelKey])
	})

	t.Run("deleting the group deletes the sequence", func(t *testing.T) {
		legacyClient.ConvertPrometheusDeleteRuleGroup(t, "Test Folder", group.Name, nil)

		// The rules app removes the sequence's finalizer once it has processed the deletion.
		require.Eventually(t, func() bool {
			_, err := seqClient.Get(ctx, seqName, v1.GetOptions{})
			return apierrors.IsNotFound(err)
		}, 10*time.Second, 100*time.Millisecond)
		_, err := recClient.Get(ctx, recordingUID, v1.GetOptions{})
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("deleting the namespace deletes its converted rules", func(t *testing.T) {
		legacyClient.ConvertPrometheusDeleteNamespace(t, "Test Folder", nil)
		require.Empty(t, groupRules(t, alertClient, "alerts-only"))
		require.Empty(t, groupRules(t, alertClient, "pinned-b"))
	})
}

func groupRules(t *testing.T, client *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList], group string) []v0alpha1.AlertRule {
	t.Helper()
	list, err := client.List(context.Background(), v1.ListOptions{})
	require.NoError(t, err)
	var result []v0alpha1.AlertRule
	for _, r := range list.Items {
		if r.Labels[v1beta1.GroupLabelKey] == group {
			result = append(result, r)
		}
	}
	return result
}
