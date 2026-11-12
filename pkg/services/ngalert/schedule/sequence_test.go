package schedule

import (
	"context"
	"fmt"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"golang.org/x/sync/errgroup"
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

	t.Run("sequence group with multiple rules evaluates sequentially", func(t *testing.T) {
		seqGroup := sequenceGroupName(t, "seq-123")
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
				ruleRoutine: &fakeSequenceRule{UID: "c1", Group: seqGroup},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("c1"),
						models.RuleGen.WithGroupIndex(1),
						models.RuleGen.WithGroupName(seqGroup),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "c2", Group: seqGroup},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("c2"),
						models.RuleGen.WithGroupIndex(2),
						models.RuleGen.WithGroupName(seqGroup),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
			{
				ruleRoutine: &fakeSequenceRule{UID: "c3", Group: seqGroup},
				Evaluation: Evaluation{
					rule: gen.With(
						models.RuleGen.WithUID("c3"),
						models.RuleGen.WithGroupIndex(3),
						models.RuleGen.WithGroupName(seqGroup),
					).GenerateRef(),
					folderTitle: "folder1",
				},
			},
		}

		sequences := sch.buildSequences(items, callback)
		// Three sequence rules should produce one sequence (linked).
		require.Equal(t, 1, len(sequences))
		require.Equal(t, "c1", sequences[0].rule.UID)

		// Run the sequence.
		sequences[0].ruleRoutine.Eval(&sequences[0].Evaluation)

		require.Equal(t, []string{"c2", "c3"}, nextByGroup[seqGroup])
		require.Equal(t, []string{"c1", "c2"}, prevByGroup[seqGroup])
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

	t.Run("sequence group with two rules returns true", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		seqGroup := sequenceGroupName(t, "my-seq")
		items := []readyToRunItem{
			makeItem("a", seqGroup),
			makeItem("b", seqGroup),
		}
		require.True(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("sequence group with one rule returns false", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		seqGroup := sequenceGroupName(t, "solo")
		items := []readyToRunItem{
			makeItem("a", seqGroup),
		}
		require.False(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("sequence group is independent of jitter setting", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		sch.jitterEvaluations = JitterByGroup
		seqGroup := sequenceGroupName(t, "jitter-test")
		items := []readyToRunItem{
			makeItem("a", seqGroup),
			makeItem("b", seqGroup),
		}
		require.True(t, sch.shouldEvaluateSequentially(items))
	})

	t.Run("sequence group returns false when jitter by rule is enabled", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		sch.jitterEvaluations = JitterByRule
		seqGroup := sequenceGroupName(t, "jitter-rule")
		items := []readyToRunItem{
			makeItem("a", seqGroup),
			makeItem("b", seqGroup),
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

	t.Run("unpadded sequence prefix is not treated as sequence group", func(t *testing.T) {
		sch := setupScheduler(t, newFakeRulesStore(), nil, nil, nil, nil, nil)
		// A user-creatable group name that happens to start with the prefix
		// but is not padded to sentinel length should NOT be sequential.
		fakeGroup := models.RuleSequenceGroupPrefix + "user-created"
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

// Rules in imported Prometheus groups are chained into one sequence per group, and the scheduler
// starts one timer per sequence. The spacing between those timers must therefore be derived from
// the number of sequences; deriving it from the number of rules squeezes every start into the first
// fraction of the tick.
func TestProcessTick_ImportedGroupsStartsAreSpreadAcrossTheTick(t *testing.T) {
	const (
		groups   = 5
		perGroup = 10
	)

	ctx := context.Background()
	ruleStore := newFakeRulesStore()
	sch := setupScheduler(t, ruleStore, nil, prometheus.NewPedanticRegistry(), nil, nil, nil)
	sch.jitterEvaluations = JitterByGroup

	type ruleInfo struct {
		group string
		index int
	}
	var mu sync.Mutex
	infoByRule := map[models.AlertRuleKey]ruleInfo{}
	evalAt := map[models.AlertRuleKey]time.Duration{}
	var begin time.Time
	done := make(chan struct{}, groups*perGroup)
	sch.evalAppliedFunc = func(key models.AlertRuleKey, _ time.Time) {
		mu.Lock()
		defer mu.Unlock()
		evalAt[key] = time.Since(begin)
		done <- struct{}{}
	}
	sch.stopAppliedFunc = func(models.AlertRuleKey) {}

	gen := models.RuleGen
	for g := 0; g < groups; g++ {
		for r := 0; r < perGroup; r++ {
			rule := gen.With(
				gen.WithOrgID(1),
				gen.WithNamespaceUID("ns"),
				gen.WithGroupName(fmt.Sprintf("imported-%d", g)),
				gen.WithGroupIndex(r+1),
				gen.WithInterval(sch.baseInterval),
				gen.WithPrometheusOriginalRuleDefinition("x"),
			).GenerateRef()
			infoByRule[rule.GetKey()] = ruleInfo{group: rule.RuleGroup, index: r}
			ruleStore.PutRule(ctx, rule)
		}
	}

	dispatcherGroup, gctx := errgroup.WithContext(ctx)
	begin = time.Now()
	scheduled, _, _ := sch.processTick(gctx, dispatcherGroup, time.Time{}.Add(sch.baseInterval))
	require.Len(t, scheduled, groups*perGroup)

	for i := 0; i < groups*perGroup; i++ {
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Fatalf("timed out waiting for evaluations (%d/%d done)", i, groups*perGroup)
		}
	}

	mu.Lock()
	defer mu.Unlock()

	// Collect each group's evaluation times in group-index order.
	timesByGroup := map[string][]time.Duration{}
	for key, info := range infoByRule {
		if timesByGroup[info.group] == nil {
			timesByGroup[info.group] = make([]time.Duration, perGroup)
		}
		timesByGroup[info.group][info.index] = evalAt[key]
	}
	require.Len(t, timesByGroup, groups)

	starts := make([]time.Duration, 0, groups)
	for group, times := range timesByGroup {
		// The rules of an imported group are chained: each starts after the previous one finished.
		for i := 1; i < len(times); i++ {
			require.GreaterOrEqual(t, times[i], times[i-1], "rules of group %s are not evaluated in order", group)
		}
		starts = append(starts, times[0])
	}
	slices.Sort(starts)
	t.Logf("%d groups, base interval %v: sequence starts at %v", groups, sch.baseInterval, starts)

	// With 5 sequences and a 1s interval the starts are 200ms apart, the last at 800ms. Before the fix
	// the step was 1s/50 rules = 20ms, so all starts fell within the first ~80ms. The bounds below are
	// deliberately loose (lower bounds on gaps/last start) so that a slow machine cannot fail the test.
	for i := 1; i < len(starts); i++ {
		require.GreaterOrEqual(t, starts[i]-starts[i-1], 50*time.Millisecond, "sequence starts %d and %d are bunched together", i-1, i)
	}
	require.GreaterOrEqual(t, starts[len(starts)-1], 600*time.Millisecond, "sequence starts are bunched at the beginning of the tick")
}
