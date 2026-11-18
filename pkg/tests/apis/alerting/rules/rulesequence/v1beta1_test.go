package rulesequence

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// v0alpha1's spec.alertingRules is spec.alertRules in v1beta1. Whichever
// version writes a sequence, the other reads it under its own field name.
func TestIntegrationRuleSequenceV1beta1(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelperWithRuleSequences(t)
	common.CreateTestFolder(t, helper, "test-folder")

	alpha := common.NewRuleSequenceClient(t, helper.Org1.Admin)
	beta := helper.Org1.Admin.RESTClient(t, &v1beta1.GroupVersion)
	betaPath := func(name ...string) []string {
		return append([]string{"apis", v1beta1.GroupVersion.Group, v1beta1.GroupVersion.Version, "namespaces", "default", "rulesequences"}, name...)
	}

	t.Run("a sequence written as v0alpha1 is read as v1beta1", func(t *testing.T) {
		rec, alert := createRecordingRule(t, helper), createAlertRule(t, helper)
		created, err := alpha.Create(ctx, &v0alpha1.RuleSequence{
			ObjectMeta: v1.ObjectMeta{Namespace: "default", GenerateName: "seq-", Annotations: map[string]string{v0alpha1.FolderAnnotationKey: "test-folder"}},
			Spec: v0alpha1.RuleSequenceSpec{
				Trigger:        v0alpha1.RuleSequenceIntervalTrigger{Interval: "1m"},
				RecordingRules: []v0alpha1.RuleSequenceRuleRef{{Name: v0alpha1.RuleSequenceRuleUID(rec)}},
				AlertingRules:  []v0alpha1.RuleSequenceRuleRef{{Name: v0alpha1.RuleSequenceRuleUID(alert)}},
			},
		}, v1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = alpha.Delete(ctx, created.Name, v1.DeleteOptions{}) })

		got := getJSON(t, beta.Get().AbsPath(betaPath(created.Name)...))
		require.Equal(t, v1beta1.GroupVersion.String(), got["apiVersion"])
		spec := got["spec"].(map[string]any)
		assert.Equal(t, []any{map[string]any{"name": alert}}, spec["alertRules"])
		assert.NotContains(t, spec, "alertingRules")

		list := getJSON(t, beta.Get().AbsPath(betaPath()...))
		var found bool
		for _, item := range list["items"].([]any) {
			obj := item.(map[string]any)
			if obj["metadata"].(map[string]any)["name"] == created.Name {
				found = true
				assert.Equal(t, []any{map[string]any{"name": alert}}, obj["spec"].(map[string]any)["alertRules"])
			}
		}
		require.True(t, found, "v1beta1 list is missing %s", created.Name)
	})

	t.Run("a sequence written as v1beta1 is read as v0alpha1", func(t *testing.T) {
		rec, alert := createRecordingRule(t, helper), createAlertRule(t, helper)
		body, err := json.Marshal(map[string]any{
			"apiVersion": v1beta1.GroupVersion.String(),
			"kind":       "RuleSequence",
			"metadata":   map[string]any{"generateName": "seq-", "annotations": map[string]string{v1beta1.FolderAnnotationKey: "test-folder"}},
			"spec": map[string]any{
				"trigger":        map[string]any{"interval": "1m"},
				"recordingRules": []any{map[string]any{"name": rec}},
				"alertRules":     []any{map[string]any{"name": alert}},
			},
		})
		require.NoError(t, err)
		created := getJSON(t, beta.Post().AbsPath(betaPath()...).Body(body))
		name := created["metadata"].(map[string]any)["name"].(string)
		t.Cleanup(func() { _ = alpha.Delete(ctx, name, v1.DeleteOptions{}) })
		assert.Equal(t, []any{map[string]any{"name": alert}}, created["spec"].(map[string]any)["alertRules"])

		got, err := alpha.Get(ctx, name, v1.GetOptions{})
		require.NoError(t, err)
		assert.Equal(t, []v0alpha1.RuleSequenceRuleRef{{Name: v0alpha1.RuleSequenceRuleUID(alert)}}, got.Spec.AlertingRules)
	})

	t.Run("v1beta1 rejects spec.alertingRules", func(t *testing.T) {
		rec := createRecordingRule(t, helper)
		body, err := json.Marshal(map[string]any{
			"apiVersion": v1beta1.GroupVersion.String(),
			"kind":       "RuleSequence",
			"metadata":   map[string]any{"generateName": "seq-", "annotations": map[string]string{v1beta1.FolderAnnotationKey: "test-folder"}},
			"spec": map[string]any{
				"trigger":        map[string]any{"interval": "1m"},
				"recordingRules": []any{map[string]any{"name": rec}},
				"alertingRules":  []any{map[string]any{"name": rec}},
			},
		})
		require.NoError(t, err)
		raw, err := beta.Post().AbsPath(betaPath()...).Param("fieldValidation", "Strict").Body(body).DoRaw(ctx)
		require.Error(t, err, "%s", raw)
	})
}

func getJSON(t *testing.T, req *rest.Request) map[string]any {
	t.Helper()
	raw, err := req.DoRaw(context.Background())
	require.NoError(t, err, "%s", raw)
	var out map[string]any
	require.NoError(t, json.Unmarshal(raw, &out))
	return out
}

func createRecordingRule(t *testing.T, helper *apis.K8sTestHelper) string {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()
	created, err := common.NewRecordingRuleClient(t, helper.Org1.Admin).Create(context.Background(), &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{Name: rule.UID, Namespace: "default", Annotations: map[string]string{v0alpha1.FolderAnnotationKey: "test-folder"}},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:               rule.Title,
			Metric:              v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
			TargetDatasourceUID: v0alpha1.RecordingRuleDatasourceUID(rule.Record.TargetDatasourceUID),
			Expressions: v0alpha1.RecordingRuleExpressionMap{"A": {
				QueryType:         new(rule.Data[0].QueryType),
				DatasourceUID:     new(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
				Model:             rule.Data[0].Model,
				Source:            new(true),
				RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{From: "5m", To: "0s"},
			}},
			Trigger: v0alpha1.RecordingRuleIntervalTrigger{Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))},
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	return created.Name
}

func createAlertRule(t *testing.T, helper *apis.K8sTestHelper) string {
	t.Helper()
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithIntervalMatching(10*time.Second),
	).Generate()
	created, err := common.NewAlertRuleClient(t, helper.Org1.Admin).Create(context.Background(), &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{Name: rule.UID, Namespace: "default", Annotations: map[string]string{v0alpha1.FolderAnnotationKey: "test-folder"}},
		Spec: v0alpha1.AlertRuleSpec{
			Title: rule.Title,
			Expressions: v0alpha1.AlertRuleExpressionMap{"A": {
				QueryType:         new("query"),
				DatasourceUID:     new(v0alpha1.AlertRuleDatasourceUID(rule.Data[0].DatasourceUID)),
				Model:             rule.Data[0].Model,
				Source:            new(true),
				RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{From: "5m", To: "0s"},
			}},
			Trigger:      v0alpha1.AlertRuleIntervalTrigger{Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds))},
			NoDataState:  common.ToK8sNoDataState(rule.NoDataState),
			ExecErrState: common.ToK8sExecErrState(rule.ExecErrState),
			NotificationSettings: &v0alpha1.AlertRuleNotificationSettings{SimplifiedRouting: &v0alpha1.AlertRuleSimplifiedRouting{
				Type:     v0alpha1.AlertRuleNotificationSettingsTypeSimplifiedRouting,
				Receiver: "empty",
			}},
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	return created.Name
}
