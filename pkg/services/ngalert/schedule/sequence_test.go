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
}
