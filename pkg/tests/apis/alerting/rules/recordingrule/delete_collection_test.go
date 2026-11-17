package recordingrule

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulescommon "github.com/grafana/grafana/pkg/registry/apps/alerting/rules/common"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationDeleteCollection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelper(t)
	client := common.NewRecordingRuleClient(t, helper.Org1.Admin)
	viewerClient := common.NewRecordingRuleClient(t, helper.Org1.Viewer)
	alertClient := common.NewAlertRuleClient(t, helper.Org1.Admin)

	common.CreateTestFolder(t, helper, "rdc-folder-alpha")
	common.CreateTestFolder(t, helper, "rdc-folder-beta")

	makeRule := func(folder string) *v0alpha1.RecordingRule {
		rule := ngmodels.RuleGen.With(
			ngmodels.RuleMuts.WithUniqueUID(),
			ngmodels.RuleMuts.WithUniqueTitle(),
			ngmodels.RuleMuts.WithAllRecordingRules(),
			ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
		).Generate()
		return &v0alpha1.RecordingRule{
			ObjectMeta: v1.ObjectMeta{
				Namespace:   "default",
				Annotations: map[string]string{"grafana.app/folder": folder},
			},
			Spec: v0alpha1.RecordingRuleSpec{
				Title:               rule.Title,
				Metric:              v0alpha1.RecordingRuleMetricName(rule.Record.Metric),
				TargetDatasourceUID: v0alpha1.RecordingRuleDatasourceUID(rule.Record.TargetDatasourceUID),
				Expressions: v0alpha1.RecordingRuleExpressionMap{
					"A": {
						QueryType:     new(rule.Data[0].QueryType),
						DatasourceUID: new(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
						Model:         rule.Data[0].Model,
						Source:        new(true),
						RelativeTimeRange: &v0alpha1.RecordingRuleRelativeTimeRange{
							From: v0alpha1.RecordingRulePromDurationWMillis("5m"),
							To:   v0alpha1.RecordingRulePromDurationWMillis("0s"),
						},
					},
				},
				Trigger: v0alpha1.RecordingRuleIntervalTrigger{
					Interval: v0alpha1.RecordingRulePromDuration(fmt.Sprintf("%ds", rule.IntervalSeconds)),
				},
			},
		}
	}

	alpha1, err := client.Create(ctx, makeRule("rdc-folder-alpha"), v1.CreateOptions{})
	require.NoError(t, err)
	alpha2, err := client.Create(ctx, makeRule("rdc-folder-alpha"), v1.CreateOptions{})
	require.NoError(t, err)
	beta1, err := client.Create(ctx, makeRule("rdc-folder-beta"), v1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() {
		for _, name := range []string{alpha1.Name, alpha2.Name, beta1.Name} {
			_ = client.Delete(ctx, name, v1.DeleteOptions{})
		}
	})

	// An alert rule in the folder being deleted from must survive: the two kinds share a table and a folder.
	alert := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()
	alertRule, err := alertClient.Create(ctx, &v0alpha1.AlertRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace:   "default",
			Annotations: map[string]string{"grafana.app/folder": "rdc-folder-alpha"},
		},
		Spec: v0alpha1.AlertRuleSpec{
			Title: alert.Title,
			Expressions: v0alpha1.AlertRuleExpressionMap{
				"A": {
					QueryType:     new("query"),
					DatasourceUID: new(v0alpha1.AlertRuleDatasourceUID(alert.Data[0].DatasourceUID)),
					Model:         alert.Data[0].Model,
					Source:        new(true),
					RelativeTimeRange: &v0alpha1.AlertRuleRelativeTimeRange{
						From: v0alpha1.AlertRulePromDurationWMillis("5m"),
						To:   v0alpha1.AlertRulePromDurationWMillis("0s"),
					},
				},
			},
			Trigger: v0alpha1.AlertRuleIntervalTrigger{
				Interval: v0alpha1.AlertRulePromDuration(fmt.Sprintf("%ds", alert.IntervalSeconds)),
			},
			NoDataState:  common.ToK8sNoDataState(alert.NoDataState),
			ExecErrState: common.ToK8sExecErrState(alert.ExecErrState),
		},
	}, v1.CreateOptions{})
	require.NoError(t, err)
	t.Cleanup(func() { _ = alertClient.Delete(ctx, alertRule.Name, v1.DeleteOptions{}) })

	alphaSelector := v1.ListOptions{LabelSelector: "grafana.app/folder=rdc-folder-alpha"}
	betaSelector := v1.ListOptions{LabelSelector: "grafana.app/folder=rdc-folder-beta"}

	t.Run("a user without delete permission cannot delete the collection", func(t *testing.T) {
		err := viewerClient.Client.DeleteCollection(ctx, v1.DeleteOptions{}, alphaSelector)
		require.True(t, k8serrors.IsForbidden(err), "got %v", err)

		list, err := client.List(ctx, alphaSelector)
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
	})

	t.Run("dry-run is rejected and deletes nothing", func(t *testing.T) {
		err := client.Client.DeleteCollection(ctx, v1.DeleteOptions{DryRun: []string{v1.DryRunAll}}, alphaSelector)
		require.True(t, k8serrors.IsBadRequest(err), "got %v", err)

		list, err := client.List(ctx, alphaSelector)
		require.NoError(t, err)
		require.Len(t, list.Items, 2)
	})

	t.Run("honors a limit larger than a page", func(t *testing.T) {
		pageSize := rulescommon.DeleteCollectionPageSize
		rulescommon.DeleteCollectionPageSize = 1
		t.Cleanup(func() { rulescommon.DeleteCollectionPageSize = pageSize })
		common.CreateTestFolder(t, helper, "rdc-folder-gamma")
		for range 3 {
			created, err := client.Create(ctx, makeRule("rdc-folder-gamma"), v1.CreateOptions{})
			require.NoError(t, err)
			t.Cleanup(func() { _ = client.Delete(ctx, created.Name, v1.DeleteOptions{}) })
		}
		selector := v1.ListOptions{LabelSelector: "grafana.app/folder=rdc-folder-gamma"}

		limited := selector
		limited.Limit = 2
		require.NoError(t, client.Client.DeleteCollection(ctx, v1.DeleteOptions{}, limited))

		list, err := client.List(ctx, selector)
		require.NoError(t, err)
		require.Len(t, list.Items, 1, "the limit spans two pages, so two of the three recording rules are deleted")
	})

	t.Run("deletes only the recording rules matching the selector", func(t *testing.T) {
		// One rule per page makes the two matching rules take two list-and-delete rounds.
		pageSize := rulescommon.DeleteCollectionPageSize
		rulescommon.DeleteCollectionPageSize = 1
		t.Cleanup(func() { rulescommon.DeleteCollectionPageSize = pageSize })

		require.NoError(t, client.Client.DeleteCollection(ctx, v1.DeleteOptions{}, alphaSelector))

		list, err := client.List(ctx, alphaSelector)
		require.NoError(t, err)
		require.Empty(t, list.Items)

		list, err = client.List(ctx, betaSelector)
		require.NoError(t, err)
		require.Len(t, list.Items, 1)
		require.Equal(t, beta1.Name, list.Items[0].Name)

		alerts, err := alertClient.List(ctx, alphaSelector)
		require.NoError(t, err)
		require.Len(t, alerts.Items, 1)
		require.Equal(t, alertRule.Name, alerts.Items[0].Name)
	})
}
