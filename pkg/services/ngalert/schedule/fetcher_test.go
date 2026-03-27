package schedule

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// chainGroupName builds the expected padded sentinel for a given chain UID.
// It fails the test immediately on invalid UIDs so setup failures are visible.
func chainGroupName(t *testing.T, chainUID string) string {
	t.Helper()
	g, err := models.NewRuleChainGroup(chainUID)
	require.NoError(t, err)
	return g.String()
}

func TestEnrichRulesWithChainMembership(t *testing.T) {
	gen := models.RuleGen.With(
		models.RuleGen.WithNamespaceUID("ns1"),
		models.RuleGen.WithGroupName("original-group"),
		models.RuleGen.WithIntervalSeconds(60),
		models.RuleGen.WithGroupIndex(99),
	)

	t.Run("chain members get correct synthetic group, index, and interval", func(t *testing.T) {
		rec1 := gen.With(models.RuleGen.WithUID("rec-1")).GenerateRef()
		rec2 := gen.With(models.RuleGen.WithUID("rec-2")).GenerateRef()
		alert1 := gen.With(models.RuleGen.WithUID("alert-1")).GenerateRef()

		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-abc",
				IntervalSeconds:   30,
				RecordingRuleRefs: []string{"rec-1", "rec-2"},
				AlertRuleRefs:     []string{"alert-1"},
			},
		}

		rules := []*models.AlertRule{rec1, rec2, alert1}
		models.EnrichRulesWithChainMembership(rules, chains)

		expected := chainGroupName(t, "chain-abc")
		assert.Equal(t, expected, rec1.RuleGroup)
		assert.Equal(t, 1, rec1.RuleGroupIndex)
		assert.Equal(t, int64(30), rec1.IntervalSeconds)

		assert.Equal(t, expected, rec2.RuleGroup)
		assert.Equal(t, 2, rec2.RuleGroupIndex)
		assert.Equal(t, int64(30), rec2.IntervalSeconds)

		assert.Equal(t, expected, alert1.RuleGroup)
		assert.Equal(t, 3, alert1.RuleGroupIndex)
		assert.Equal(t, int64(30), alert1.IntervalSeconds)
	})

	t.Run("recording rules indexed before alerting rules", func(t *testing.T) {
		alert1 := gen.With(models.RuleGen.WithUID("alert-1")).GenerateRef()
		rec1 := gen.With(models.RuleGen.WithUID("rec-1")).GenerateRef()

		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-order",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"rec-1"},
				AlertRuleRefs:     []string{"alert-1"},
			},
		}

		rules := []*models.AlertRule{alert1, rec1}
		models.EnrichRulesWithChainMembership(rules, chains)

		// Recording rule should have a lower index than alerting rule,
		// regardless of the order they appear in the rules slice.
		require.Less(t, rec1.RuleGroupIndex, alert1.RuleGroupIndex)
		assert.Equal(t, 1, rec1.RuleGroupIndex)
		assert.Equal(t, 2, alert1.RuleGroupIndex)
	})

	t.Run("non-chain rules are unchanged", func(t *testing.T) {
		standalone := gen.With(models.RuleGen.WithUID("standalone")).GenerateRef()
		chainRule := gen.With(models.RuleGen.WithUID("chain-rule")).GenerateRef()

		originalGroup := standalone.RuleGroup
		originalIndex := standalone.RuleGroupIndex
		originalInterval := standalone.IntervalSeconds

		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-xyz",
				IntervalSeconds:   15,
				RecordingRuleRefs: []string{"chain-rule"},
			},
		}

		rules := []*models.AlertRule{standalone, chainRule}
		models.EnrichRulesWithChainMembership(rules, chains)

		assert.Equal(t, originalGroup, standalone.RuleGroup)
		assert.Equal(t, originalIndex, standalone.RuleGroupIndex)
		assert.Equal(t, originalInterval, standalone.IntervalSeconds)

		// chain-rule should be enriched
		assert.Equal(t, chainGroupName(t, "chain-xyz"), chainRule.RuleGroup)
	})

	t.Run("rule in chain but not in fetched rules is a no-op", func(t *testing.T) {
		rule := gen.With(models.RuleGen.WithUID("existing")).GenerateRef()

		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-ghost",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"non-existent-uid"},
				AlertRuleRefs:     []string{"also-missing"},
			},
		}

		rules := []*models.AlertRule{rule}
		originalGroup := rule.RuleGroup
		models.EnrichRulesWithChainMembership(rules, chains)

		assert.Equal(t, originalGroup, rule.RuleGroup, "rule not in any chain should be unchanged")
	})

	t.Run("empty chains produces no changes", func(t *testing.T) {
		rule := gen.With(models.RuleGen.WithUID("lonely")).GenerateRef()
		originalGroup := rule.RuleGroup
		originalIndex := rule.RuleGroupIndex
		originalInterval := rule.IntervalSeconds

		rules := []*models.AlertRule{rule}
		models.EnrichRulesWithChainMembership(rules, nil)

		assert.Equal(t, originalGroup, rule.RuleGroup)
		assert.Equal(t, originalIndex, rule.RuleGroupIndex)
		assert.Equal(t, originalInterval, rule.IntervalSeconds)
	})

	t.Run("empty rules with chains is a no-op", func(t *testing.T) {
		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-no-rules",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"rec-1"},
			},
		}

		// Should not panic.
		models.EnrichRulesWithChainMembership(nil, chains)
	})

	t.Run("multiple chains enrich independently", func(t *testing.T) {
		rule1 := gen.With(models.RuleGen.WithUID("r1")).GenerateRef()
		rule2 := gen.With(models.RuleGen.WithUID("r2")).GenerateRef()
		rule3 := gen.With(models.RuleGen.WithUID("r3")).GenerateRef()

		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-A",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"r1"},
				AlertRuleRefs:     []string{"r2"},
			},
			{
				UID:             "chain-B",
				IntervalSeconds: 20,
				AlertRuleRefs:   []string{"r3"},
			},
		}

		rules := []*models.AlertRule{rule1, rule2, rule3}
		models.EnrichRulesWithChainMembership(rules, chains)

		expectedA := chainGroupName(t, "chain-A")
		assert.Equal(t, expectedA, rule1.RuleGroup)
		assert.Equal(t, int64(10), rule1.IntervalSeconds)
		assert.Equal(t, 1, rule1.RuleGroupIndex)

		assert.Equal(t, expectedA, rule2.RuleGroup)
		assert.Equal(t, int64(10), rule2.IntervalSeconds)
		assert.Equal(t, 2, rule2.RuleGroupIndex)

		expectedB := chainGroupName(t, "chain-B")
		assert.Equal(t, expectedB, rule3.RuleGroup)
		assert.Equal(t, int64(20), rule3.IntervalSeconds)
		assert.Equal(t, 1, rule3.RuleGroupIndex)
	})

	t.Run("rule referenced by multiple chains uses last chain", func(t *testing.T) {
		// This shouldn't happen in practice (admission prevents it),
		// but test the defensive behavior: last-write-wins from map insertion.
		rule := gen.With(models.RuleGen.WithUID("shared")).GenerateRef()

		chains := []models.SchedulableRuleChain{
			{
				UID:               "chain-first",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"shared"},
			},
			{
				UID:             "chain-second",
				IntervalSeconds: 20,
				AlertRuleRefs:   []string{"shared"},
			},
		}

		rules := []*models.AlertRule{rule}
		models.EnrichRulesWithChainMembership(rules, chains)

		// The second chain overwrites the first in the lookup map.
		assert.Equal(t, chainGroupName(t, "chain-second"), rule.RuleGroup)
		assert.Equal(t, int64(20), rule.IntervalSeconds)
	})
}
