package rulechain

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/tests/apis/alerting/rules/common"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// TestIntegrationRuleChainUnifiedStorageOnly verifies that RuleChain resources
// work correctly with unified storage only (nil legacy storage). This exercises
// the code path in appinstaller/server.go where GetLegacyStorage returns nil
// and the dual-writer is skipped.
func TestIntegrationRuleChainUnifiedStorageOnly(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := context.Background()
	helper := common.GetTestHelperWithRuleChains(t)

	common.CreateTestFolder(t, helper, "test-folder")

	// Create a recording rule so the chain validator's ResolveRuleRef check passes.
	recClient := common.NewRecordingRuleClient(t, helper.Org1.Admin)
	rule := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithUniqueUID(),
		ngmodels.RuleMuts.WithUniqueTitle(),
		ngmodels.RuleMuts.WithNamespaceUID("test-folder"),
		ngmodels.RuleMuts.WithGroupName("test-group"),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithIntervalMatching(time.Duration(10)*time.Second),
	).Generate()

	recRule, err := recClient.Create(ctx, &v0alpha1.RecordingRule{
		ObjectMeta: v1.ObjectMeta{
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder",
			},
		},
		Spec: v0alpha1.RecordingRuleSpec{
			Title:  rule.Title,
			Metric: rule.Record.Metric,
			Expressions: v0alpha1.RecordingRuleExpressionMap{
				"A": {
					QueryType:     util.Pointer(rule.Data[0].QueryType),
					DatasourceUID: util.Pointer(v0alpha1.RecordingRuleDatasourceUID(rule.Data[0].DatasourceUID)),
					Model:         rule.Data[0].Model,
					Source:        util.Pointer(true),
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
	}, v1.CreateOptions{})
	require.NoError(t, err, "recording rule must exist for chain validation")

	chainClient := common.NewRuleChainClient(t, helper.Org1.Admin)

	t.Run("create, get, list, and delete", func(t *testing.T) {
		chain := &v0alpha1.RuleChain{
			ObjectMeta: v1.ObjectMeta{
				Namespace: "default",
			},
			Spec: v0alpha1.RuleChainSpec{
				Trigger: v0alpha1.RuleChainIntervalTrigger{
					Interval: v0alpha1.RuleChainPromDuration("1m"),
				},
				RecordingRules: []v0alpha1.RuleChainRuleRef{
					{Uid: v0alpha1.RuleChainRuleUID(recRule.Name)},
				},
			},
		}

		created, err := chainClient.Create(ctx, chain, v1.CreateOptions{})
		require.NoError(t, err, "RuleChain should be creatable with unified storage only")
		require.NotEmpty(t, created.Name)

		got, err := chainClient.Get(ctx, created.Name, v1.GetOptions{})
		require.NoError(t, err)
		require.Equal(t, created.Name, got.Name)
		require.Equal(t, chain.Spec.Trigger.Interval, got.Spec.Trigger.Interval)
		require.Len(t, got.Spec.RecordingRules, 1)

		list, err := chainClient.List(ctx, v1.ListOptions{})
		require.NoError(t, err)
		require.NotEmpty(t, list.Items)

		err = chainClient.Delete(ctx, created.Name, v1.DeleteOptions{})
		require.NoError(t, err, "RuleChain should be deletable with unified storage only")
	})
}
