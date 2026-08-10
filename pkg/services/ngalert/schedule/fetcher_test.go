package schedule

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// sequenceGroupName builds the expected padded sentinel for a given sequence UID.
// It fails the test immediately on invalid UIDs so setup failures are visible.
func sequenceGroupName(t *testing.T, sequenceUID string) string {
	t.Helper()
	g, err := models.NewRuleSequenceGroup(sequenceUID)
	require.NoError(t, err)
	return g.String()
}

func TestEnrichRulesWithSequenceMembership(t *testing.T) {
	gen := models.RuleGen.With(
		models.RuleGen.WithNamespaceUID("ns1"),
		models.RuleGen.WithGroupName("original-group"),
		models.RuleGen.WithIntervalSeconds(60),
		models.RuleGen.WithGroupIndex(99),
	)

	t.Run("sequence members get correct synthetic group, index, and interval", func(t *testing.T) {
		rec1 := gen.With(models.RuleGen.WithUID("rec-1")).GenerateRef()
		rec2 := gen.With(models.RuleGen.WithUID("rec-2")).GenerateRef()
		alert1 := gen.With(models.RuleGen.WithUID("alert-1")).GenerateRef()

		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-abc",
				IntervalSeconds:   30,
				RecordingRuleRefs: []string{"rec-1", "rec-2"},
				AlertRuleRefs:     []string{"alert-1"},
			},
		}

		rules := []*models.AlertRule{rec1, rec2, alert1}
		models.EnrichRulesWithSequenceMembership(rules, sequences)

		expected := sequenceGroupName(t, "seq-abc")
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

		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-order",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"rec-1"},
				AlertRuleRefs:     []string{"alert-1"},
			},
		}

		rules := []*models.AlertRule{alert1, rec1}
		models.EnrichRulesWithSequenceMembership(rules, sequences)

		// Recording rule should have a lower index than alerting rule,
		// regardless of the order they appear in the rules slice.
		require.Less(t, rec1.RuleGroupIndex, alert1.RuleGroupIndex)
		assert.Equal(t, 1, rec1.RuleGroupIndex)
		assert.Equal(t, 2, alert1.RuleGroupIndex)
	})

	t.Run("non-sequence rules are unchanged", func(t *testing.T) {
		standalone := gen.With(models.RuleGen.WithUID("standalone")).GenerateRef()
		seqRule := gen.With(models.RuleGen.WithUID("seq-rule")).GenerateRef()

		originalGroup := standalone.RuleGroup
		originalIndex := standalone.RuleGroupIndex
		originalInterval := standalone.IntervalSeconds

		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-xyz",
				IntervalSeconds:   15,
				RecordingRuleRefs: []string{"seq-rule"},
			},
		}

		rules := []*models.AlertRule{standalone, seqRule}
		models.EnrichRulesWithSequenceMembership(rules, sequences)

		assert.Equal(t, originalGroup, standalone.RuleGroup)
		assert.Equal(t, originalIndex, standalone.RuleGroupIndex)
		assert.Equal(t, originalInterval, standalone.IntervalSeconds)

		// seq-rule should be enriched
		assert.Equal(t, sequenceGroupName(t, "seq-xyz"), seqRule.RuleGroup)
	})

	t.Run("rule in sequence but not in fetched rules is a no-op", func(t *testing.T) {
		rule := gen.With(models.RuleGen.WithUID("existing")).GenerateRef()

		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-ghost",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"non-existent-uid"},
				AlertRuleRefs:     []string{"also-missing"},
			},
		}

		rules := []*models.AlertRule{rule}
		originalGroup := rule.RuleGroup
		models.EnrichRulesWithSequenceMembership(rules, sequences)

		assert.Equal(t, originalGroup, rule.RuleGroup, "rule not in any sequence should be unchanged")
	})

	t.Run("empty sequences produces no changes", func(t *testing.T) {
		rule := gen.With(models.RuleGen.WithUID("lonely")).GenerateRef()
		originalGroup := rule.RuleGroup
		originalIndex := rule.RuleGroupIndex
		originalInterval := rule.IntervalSeconds

		rules := []*models.AlertRule{rule}
		models.EnrichRulesWithSequenceMembership(rules, nil)

		assert.Equal(t, originalGroup, rule.RuleGroup)
		assert.Equal(t, originalIndex, rule.RuleGroupIndex)
		assert.Equal(t, originalInterval, rule.IntervalSeconds)
	})

	t.Run("empty rules with sequences is a no-op", func(t *testing.T) {
		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-no-rules",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"rec-1"},
			},
		}

		// Should not panic.
		models.EnrichRulesWithSequenceMembership(nil, sequences)
	})

	t.Run("multiple sequences enrich independently", func(t *testing.T) {
		rule1 := gen.With(models.RuleGen.WithUID("r1")).GenerateRef()
		rule2 := gen.With(models.RuleGen.WithUID("r2")).GenerateRef()
		rule3 := gen.With(models.RuleGen.WithUID("r3")).GenerateRef()

		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-A",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"r1"},
				AlertRuleRefs:     []string{"r2"},
			},
			{
				UID:             "seq-B",
				IntervalSeconds: 20,
				AlertRuleRefs:   []string{"r3"},
			},
		}

		rules := []*models.AlertRule{rule1, rule2, rule3}
		models.EnrichRulesWithSequenceMembership(rules, sequences)

		expectedA := sequenceGroupName(t, "seq-A")
		assert.Equal(t, expectedA, rule1.RuleGroup)
		assert.Equal(t, int64(10), rule1.IntervalSeconds)
		assert.Equal(t, 1, rule1.RuleGroupIndex)

		assert.Equal(t, expectedA, rule2.RuleGroup)
		assert.Equal(t, int64(10), rule2.IntervalSeconds)
		assert.Equal(t, 2, rule2.RuleGroupIndex)

		expectedB := sequenceGroupName(t, "seq-B")
		assert.Equal(t, expectedB, rule3.RuleGroup)
		assert.Equal(t, int64(20), rule3.IntervalSeconds)
		assert.Equal(t, 1, rule3.RuleGroupIndex)
	})

	t.Run("rule referenced by multiple sequences uses last sequence", func(t *testing.T) {
		// This shouldn't happen in practice (admission prevents it),
		// but test the defensive behavior: last-write-wins from map insertion.
		rule := gen.With(models.RuleGen.WithUID("shared")).GenerateRef()

		sequences := []models.SchedulableRuleSequence{
			{
				UID:               "seq-first",
				IntervalSeconds:   10,
				RecordingRuleRefs: []string{"shared"},
			},
			{
				UID:             "seq-second",
				IntervalSeconds: 20,
				AlertRuleRefs:   []string{"shared"},
			},
		}

		rules := []*models.AlertRule{rule}
		models.EnrichRulesWithSequenceMembership(rules, sequences)

		// The second sequence overwrites the first in the lookup map.
		assert.Equal(t, sequenceGroupName(t, "seq-second"), rule.RuleGroup)
		assert.Equal(t, int64(20), rule.IntervalSeconds)
	})
}
