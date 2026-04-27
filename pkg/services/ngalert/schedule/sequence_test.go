package schedule

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
)

type fakeSequenceRule struct {
	// these fields help with debugging tests
	UID   string
	Group string
}

func (r *fakeSequenceRule) Eval(e *Evaluation) (bool, *Evaluation) {
	if e.afterEval != nil {
		e.afterEval()
	}
	return true, nil
}

func (r *fakeSequenceRule) Run() error {
	return nil
}

func (r *fakeSequenceRule) Stop(reason error) {
}

func (r *fakeSequenceRule) Update(e *Evaluation) bool {
	return true
}

func (r *fakeSequenceRule) Type() models.RuleType {
	return models.RuleTypeAlerting
}

func (r *fakeSequenceRule) Identifier() models.AlertRuleKeyWithGroup {
	return models.AlertRuleKeyWithGroup{
		AlertRuleKey: models.AlertRuleKey{
			UID: r.UID,
		},
		RuleGroup: r.Group,
	}
}

func (r *fakeSequenceRule) Status() models.RuleStatus {
	return models.RuleStatus{}
}

func TestSequence(t *testing.T) {
	ruleStore := newFakeRulesStore()
	reg := prometheus.NewPedanticRegistry()
	sch := setupScheduler(t, ruleStore, nil, reg, nil, nil, nil)
	gen := models.RuleGen.With(models.RuleGen.WithNamespaceUID("ns1"))

	t.Run("should set callbacks in correct order", func(t *testing.T) {
		nextByGroup := map[string][]string{}
		prevByGroup := map[string][]string{}
		callback := func(next readyToRunItem, prev ...readyToRunItem) func() {
			return func() {
				group := next.rule.RuleGroup
				nextByGroup[group] = append(nextByGroup[group], next.rule.UID)
				if len(prev) > 0 {
					prevByGroup[group] = append(prevByGroup[group], prev[0].rule.UID)
				}
				// Ensure we call the eval the next rule
				next.ruleRoutine.Eval(&next.Evaluation)
			}
		}
		// rg1 : 1, 2
		// rg2 : 3, 4 (prometheus), 5 (prometheus)
		items := []readyToRunItem{
			{
				ruleRoutine: &fakeSequenceRule{UID: "3", Group: "rg2"},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("3"),
						models.RuleGen.WithGroupIndex(1),
						models.RuleGen.WithGroupName("rg2"),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "4", Group: "rg2"},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("4"),
						models.RuleGen.WithGroupIndex(2),
						models.RuleGen.WithGroupName("rg2"),
						// This rule has the Prometheus rule YAML definition,
						// indicating it was converted from Prometheus.
						models.RuleGen.WithPrometheusOriginalRuleDefinition("test"),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "5", Group: "rg2"},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("5"),
						models.RuleGen.WithGroupIndex(3),
						models.RuleGen.WithGroupName("rg2"),
						// This rule does not have the YAML definition,
						// but still has the label indicating it was converted from Prometheus.
						models.RuleGen.WithLabel(models.ConvertedPrometheusRuleLabel, "true"),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "1", Group: "rg1"},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("1"),
						models.RuleGen.WithGroupIndex(1),
						models.RuleGen.WithGroupName("rg1"),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "2", Group: "rg1"},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("2"),
						models.RuleGen.WithGroupIndex(2),
						models.RuleGen.WithGroupName("rg1"),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
		}
		sequences := sch.buildSequences(items, callback)
		require.Equal(t, 3, len(sequences))

		// Ensure sequences are sorted by UID
		require.Equal(t, "1", sequences[0].rule.UID)
		require.Equal(t, "2", sequences[1].rule.UID)
		require.Equal(t, "3", sequences[2].rule.UID)

		// Run the sequences
		for _, sequence := range sequences {
			sequence.ruleRoutine.Eval(&sequence.Evaluation)
		}

		// Verify the callbacks were called in the correct order. Since we dont sort these slices they should
		// be in the same order as the items that were added to the sequences
		require.Nil(t, nextByGroup["rg1"])
		require.Nil(t, prevByGroup["rg1"])
		require.Equal(t, []string{"4", "5"}, nextByGroup["rg2"])
		require.Equal(t, []string{"3", "4"}, prevByGroup["rg2"])
	})

	t.Run("chain group with multiple rules evaluates sequentially", func(t *testing.T) {
		chainGroup := chainGroupName(t, "chain-123")
		nextByGroup := map[string][]string{}
		prevByGroup := map[string][]string{}
		callback := func(next readyToRunItem, prev ...readyToRunItem) func() {
			return func() {
				group := next.rule.RuleGroup
				nextByGroup[group] = append(nextByGroup[group], next.rule.UID)
				if len(prev) > 0 {
					prevByGroup[group] = append(prevByGroup[group], prev[0].rule.UID)
				}
				next.ruleRoutine.Eval(&next.Evaluation)
			}
		}

		items := []readyToRunItem{
			{
				ruleRoutine: &fakeSequenceRule{UID: "c1", Group: chainGroup},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("c1"),
						models.RuleGen.WithGroupIndex(1),
						models.RuleGen.WithGroupName(chainGroup),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "c2", Group: chainGroup},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("c2"),
						models.RuleGen.WithGroupIndex(2),
						models.RuleGen.WithGroupName(chainGroup),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "c3", Group: chainGroup},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("c3"),
						models.RuleGen.WithGroupIndex(3),
						models.RuleGen.WithGroupName(chainGroup),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
		}

		sequences := sch.buildSequences(items, callback)
		// Three chain rules should produce one sequence (chained).
		require.Equal(t, 1, len(sequences))
		require.Equal(t, "c1", sequences[0].rule.UID)

		// Run the sequence.
		sequences[0].ruleRoutine.Eval(&sequences[0].Evaluation)

		require.Equal(t, []string{"c2", "c3"}, nextByGroup[chainGroup])
		require.Equal(t, []string{"c1", "c2"}, prevByGroup[chainGroup])
	})
}

func TestShouldEvaluateSequentially(t *testing.T) {
	gen := models.RuleGen.With(models.RuleGen.WithNamespaceUID("ns1"))

	makeItem := func(uid, group string) readyToRunItem {
		return readyToRunItem{
			ruleRoutine: &fakeSequenceRule{UID: uid, Group: group},
			Evaluation: Evaluation{
				rule: gen.With(
					models.RuleGen.WithUID(uid),
					models.RuleGen.WithGroupName(group),
				).GenerateRef(),
				folderTitle: "folder1",
			},
		}
	}

	makePrometheusItem := func(uid, group string) readyToRunItem {
		return readyToRunItem{
			ruleRoutine: &fakeSequenceRule{UID: uid, Group: group},
			Evaluation: Evaluation{
				rule: gen.With(
					models.RuleGen.WithUID(uid),
					models.RuleGen.WithGroupName(group),
					models.RuleGen.WithPrometheusOriginalRuleDefinition("test"),
				).GenerateRef(),
				folderTitle: "folder1",
			},
		}
	}

	t.Run("chain group with two rules returns true", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		chainGroup := chainGroupName(t, "my-chain")
		items := []readyToRunItem{
			makeItem("a", chainGroup),
			makeItem("b", chainGroup),
		}
		require.True(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("chain group with one rule returns false", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		chainGroup := chainGroupName(t, "solo")
		items := []readyToRunItem{
			makeItem("a", chainGroup),
		}
		require.False(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("chain group is independent of jitter setting", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		sch.jitterEvaluations = JitterByGroup
		chainGroup := chainGroupName(t, "jitter-test")
		items := []readyToRunItem{
			makeItem("a", chainGroup),
			makeItem("b", chainGroup),
		}
		require.True(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("chain group returns false when jitter by rule is enabled", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		sch.jitterEvaluations = JitterByRule
		chainGroup := chainGroupName(t, "jitter-rule")
		items := []readyToRunItem{
			makeItem("a", chainGroup),
			makeItem("b", chainGroup),
		}
		require.False(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("regular group with two rules returns false", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		items := []readyToRunItem{
			makeItem("a", "regular-group"),
			makeItem("b", "regular-group"),
		}
		require.False(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("unpadded chain prefix is not treated as chain group", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		// A user-creatable group name that happens to start with the prefix
		// but is not padded to sentinel length should NOT be sequential.
		fakeGroup := models.RuleChainGroupPrefix + "user-created"
		items := []readyToRunItem{
			makeItem("a", fakeGroup),
			makeItem("b", fakeGroup),
		}
		require.False(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("prometheus imported group with two rules returns true", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		items := []readyToRunItem{
			makePrometheusItem("a", "prom-group"),
			makePrometheusItem("b", "prom-group"),
		}
		require.True(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("empty items returns false", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		require.False(t, sch.shouldEvaluateSequentially(nil))
	})
}
